import {
  collectionResultSchema,
  type CollectionResult,
  type Restaurant,
} from '@lunch/shared';

import { CollectionError, safeErrorDetail, toCollectionError } from './errors.js';
import { classifyExtraction } from './freshness.js';
import type { FetchTextClient } from './http.js';
import { nullLogger, type StructuredLogger } from './logger.js';
import type { AdapterRegistry } from './registry.js';

export interface CollectRestaurantInput {
  http: FetchTextClient;
  logger?: StructuredLogger;
  registry: AdapterRegistry;
  restaurant: Restaurant;
  targetDate: string;
}

export interface RestaurantCollectionOutcome {
  errorCategory?: string;
  result: CollectionResult;
}

export async function collectRestaurant(
  input: CollectRestaurantInput,
): Promise<RestaurantCollectionOutcome> {
  const logger = input.logger ?? nullLogger;
  const startedAt = Date.now();
  logger.log('info', {
    event: 'restaurant_collection_started',
    restaurantSlug: input.restaurant.slug,
    adapter: input.restaurant.adapter,
    targetDate: input.targetDate,
  });

  try {
    const adapter = input.registry.get(input.restaurant.adapter);
    const extraction = await adapter.extract({
      restaurant: input.restaurant,
      targetDate: input.targetDate,
      http: input.http,
      logger,
    });
    const result = classifyExtraction(extraction, input.targetDate);
    logger.log('info', {
      event: 'restaurant_collection_completed',
      restaurantSlug: input.restaurant.slug,
      targetDate: input.targetDate,
      status: result.status,
      dishCount: result.dishes.length,
      durationMs: Date.now() - startedAt,
    });
    return { result };
  } catch (error) {
    const categorized = toCollectionError(error);
    const manualReviewCategories = new Set([
      'adapter_not_found',
      'blocked',
      'configuration',
      'unsupported_content_type',
    ]);
    const status = manualReviewCategories.has(categorized.category)
      ? 'manual_review'
      : 'extraction_failed';
    const result = collectionResultSchema.parse({
      status,
      statusDetail: safeErrorDetail(categorized),
      menuDate: null,
      dishes: [],
      sourceUrl: input.restaurant.menuSourceUrl,
      retrievedAt: new Date().toISOString(),
    });
    logger.log('error', {
      event: 'restaurant_collection_failed',
      restaurantSlug: input.restaurant.slug,
      targetDate: input.targetDate,
      category: categorized.category,
      retryable: categorized.retryable,
      status,
      message: categorized.message,
      durationMs: Date.now() - startedAt,
    });
    return { result, errorCategory: categorized.category };
  }
}

export function adapterFailure(message: string): CollectionError {
  return new CollectionError('parse', message);
}
