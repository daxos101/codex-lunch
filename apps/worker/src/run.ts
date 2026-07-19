import { randomUUID } from 'node:crypto';

import {
  BoundedFetchClient,
  collectRestaurant,
  createDefaultAdapterRegistry,
  type AdapterRegistry,
  type FetchTextClient,
  type StructuredLogger,
} from '@lunch/scraping';
import { stockholmDate, type CollectionResult, type Restaurant } from '@lunch/shared';

import type { RunLock, WorkerRepository } from './contracts.js';

const COLLECTION_LOCK_NAME = 'hagersten-lunch:collection';

export interface RestaurantRunResult {
  slug: string;
  status: CollectionResult['status'] | 'persistence_failed';
  errorCategory?: string;
  detail?: string;
  durationMs: number;
}

export interface CollectionRunSummary {
  runId: string;
  targetDate: string;
  requestedRestaurantSlug?: string;
  startedAt: string;
  finishedAt: string;
  status: 'completed' | 'partial_failure' | 'failed' | 'skipped_overlap';
  attemptedCount: number;
  successfulCount: number;
  failedCount: number;
  results: RestaurantRunResult[];
}

export interface RunCollectionOptions {
  repository: WorkerRepository;
  lock: RunLock;
  logger: StructuredLogger;
  targetDate?: string;
  restaurantSlug?: string;
  concurrency?: number;
  http?: FetchTextClient;
  registry?: AdapterRegistry;
}

function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const value = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(value.getTime()) && value.toISOString().slice(0, 10) === date;
}

function isFailure(status: CollectionResult['status']): boolean {
  return status === 'extraction_failed' || status === 'manual_review';
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  operation: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(Math.max(1, concurrency), values.length) },
    async () => {
      while (true) {
        const index = nextIndex;
        nextIndex += 1;
        if (index >= values.length) return;
        const value = values[index];
        if (value !== undefined) results[index] = await operation(value);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

async function selectRestaurants(
  repository: WorkerRepository,
  restaurantSlug?: string,
): Promise<Restaurant[]> {
  if (!restaurantSlug) return repository.listEnabledRestaurants();
  const restaurant = await repository.findRestaurantBySlug(restaurantSlug);
  if (!restaurant) throw new Error(`Unknown restaurant slug: ${restaurantSlug}`);
  return [restaurant];
}

function summaryStatus(
  successfulCount: number,
  failedCount: number,
): Exclude<CollectionRunSummary['status'], 'skipped_overlap'> {
  if (failedCount === 0) return 'completed';
  return successfulCount === 0 ? 'failed' : 'partial_failure';
}

export async function runCollection(
  options: RunCollectionOptions,
): Promise<CollectionRunSummary> {
  const targetDate = options.targetDate ?? stockholmDate();
  if (!isValidDate(targetDate)) {
    throw new Error(`Invalid --date value: ${targetDate}`);
  }

  const startedAt = new Date().toISOString();
  const lock = await options.lock.tryAcquire(COLLECTION_LOCK_NAME);
  if (!lock) {
    const skipped: CollectionRunSummary = {
      runId: randomUUID(),
      targetDate,
      ...(options.restaurantSlug
        ? { requestedRestaurantSlug: options.restaurantSlug }
        : {}),
      startedAt,
      finishedAt: new Date().toISOString(),
      status: 'skipped_overlap',
      attemptedCount: 0,
      successfulCount: 0,
      failedCount: 0,
      results: [],
    };
    options.logger.log('warn', {
      event: 'collection_run_skipped_overlap',
      targetDate,
      restaurantSlug: options.restaurantSlug,
    });
    return skipped;
  }

  let runId: string = randomUUID();
  try {
    const restaurants = await selectRestaurants(
      options.repository,
      options.restaurantSlug,
    );
    if (options.repository.startCollectionRun) {
      runId = await options.repository.startCollectionRun({
        targetDate,
        ...(options.restaurantSlug
          ? { requestedRestaurantSlug: options.restaurantSlug }
          : {}),
        startedAt,
      });
    }
    options.logger.log('info', {
      event: 'collection_run_started',
      runId,
      targetDate,
      restaurantCount: restaurants.length,
      concurrency: options.concurrency ?? 3,
    });

    const registry = options.registry ?? createDefaultAdapterRegistry();
    const http =
      options.http ??
      new BoundedFetchClient({
        logger: options.logger,
        retries: 2,
        timeoutMs: 10_000,
        minimumHostIntervalMs: 500,
      });
    const results = await mapWithConcurrency(
      restaurants,
      options.concurrency ?? 3,
      async (restaurant): Promise<RestaurantRunResult> => {
        const itemStartedAt = new Date().toISOString();
        const itemStartTime = Date.now();
        const outcome = await collectRestaurant({
          http,
          logger: options.logger,
          registry,
          restaurant,
          targetDate,
        });
        const finishedAt = new Date().toISOString();
        try {
          await options.repository.saveCollectionAttempt({
            restaurant,
            targetDate,
            startedAt: itemStartedAt,
            finishedAt,
            result: outcome.result,
            ...(outcome.errorCategory ? { errorCategory: outcome.errorCategory } : {}),
            runId,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unknown persistence failure';
          options.logger.log('error', {
            event: 'collection_attempt_persistence_failed',
            runId,
            restaurantSlug: restaurant.slug,
            targetDate,
            message,
          });
          return {
            slug: restaurant.slug,
            status: 'persistence_failed',
            errorCategory: 'persistence',
            detail: message.slice(0, 500),
            durationMs: Date.now() - itemStartTime,
          };
        }
        return {
          slug: restaurant.slug,
          status: outcome.result.status,
          ...(outcome.errorCategory ? { errorCategory: outcome.errorCategory } : {}),
          ...(outcome.result.statusDetail
            ? { detail: outcome.result.statusDetail }
            : {}),
          durationMs: Date.now() - itemStartTime,
        };
      },
    );

    const failedCount = results.filter((result) => {
      if (result.status === 'persistence_failed') return true;
      return isFailure(result.status);
    }).length;
    const successfulCount = results.length - failedCount;
    const finishedAt = new Date().toISOString();
    const status = summaryStatus(successfulCount, failedCount);
    const summary: CollectionRunSummary = {
      runId,
      targetDate,
      ...(options.restaurantSlug
        ? { requestedRestaurantSlug: options.restaurantSlug }
        : {}),
      startedAt,
      finishedAt,
      status,
      attemptedCount: results.length,
      successfulCount,
      failedCount,
      results,
    };

    if (options.repository.finishCollectionRun) {
      await options.repository.finishCollectionRun({
        runId,
        finishedAt,
        status,
        attemptedCount: results.length,
        successfulCount,
        failedCount,
        summary: { results },
      });
    }
    options.logger.log(status === 'completed' ? 'info' : 'warn', {
      event: 'collection_run_completed',
      ...summary,
    });
    return summary;
  } finally {
    await lock.release();
  }
}
