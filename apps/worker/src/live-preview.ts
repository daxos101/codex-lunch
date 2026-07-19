import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

import {
  BoundedFetchClient,
  ConsoleJsonLogger,
  collectRestaurant,
  createDefaultAdapterRegistry,
} from '@lunch/scraping';
import {
  STOCKHOLM_TIME_ZONE,
  TARGET_LOCATION,
  dashboardResponseSchema,
  restaurantSchema,
  stockholmDate,
  type CollectionResult,
  type Restaurant,
} from '@lunch/shared';

const PORT = 3001;
const REFRESH_INTERVAL_MS = 15 * 60 * 1_000;

interface PreviewResult {
  result: CollectionResult;
  lastAttempt: string;
  lastSuccess: string | null;
}

interface SeedDocument {
  restaurants: unknown[];
}

const logger = new ConsoleJsonLogger();
const seed = JSON.parse(
  await readFile(new URL('../../../data/restaurants.json', import.meta.url), 'utf8'),
) as SeedDocument;
const restaurants = seed.restaurants
  .map((value) => restaurantSchema.parse(value))
  .filter((restaurant) => restaurant.enabled);
const results = new Map<string, PreviewResult>();
const registry = createDefaultAdapterRegistry();
const http = new BoundedFetchClient({
  logger,
  retries: 2,
  timeoutMs: 10_000,
  minimumHostIntervalMs: 500,
});
let refreshPromise: Promise<void> | null = null;

function isSuccessfulRetrieval(status: CollectionResult['status']): boolean {
  return ['confirmed_today', 'possibly_stale', 'not_published', 'closed'].includes(
    status,
  );
}

async function collectOne(restaurant: Restaurant, targetDate: string) {
  const outcome = await collectRestaurant({
    restaurant,
    targetDate,
    http,
    registry,
    logger,
  });
  const lastAttempt = new Date().toISOString();
  results.set(restaurant.slug, {
    result: outcome.result,
    lastAttempt,
    lastSuccess: isSuccessfulRetrieval(outcome.result.status) ? lastAttempt : null,
  });
}

async function refresh(): Promise<void> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const targetDate = stockholmDate();
    logger.log('info', {
      event: 'local_preview_refresh_started',
      targetDate,
      restaurantCount: restaurants.length,
    });
    await Promise.all(
      restaurants.map((restaurant) => collectOne(restaurant, targetDate)),
    );
    logger.log('info', {
      event: 'local_preview_refresh_completed',
      targetDate,
      statuses: Object.fromEntries(
        [...results.entries()].map(([slug, value]) => [slug, value.result.status]),
      ),
    });
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

function dashboardPayload() {
  const date = stockholmDate();
  const responseRestaurants = restaurants.map((restaurant) => {
    const preview = results.get(restaurant.slug);
    const result = preview?.result;
    return {
      id: restaurant.id,
      slug: restaurant.slug,
      name: restaurant.name,
      address: restaurant.address,
      latitude: restaurant.latitude,
      longitude: restaurant.longitude,
      distanceMeters: restaurant.distanceMeters,
      websiteUrl: restaurant.websiteUrl,
      menuSourceUrl: restaurant.menuSourceUrl,
      menuSourceType: restaurant.menuSourceType,
      status: result?.status ?? ('not_published' as const),
      statusDetail:
        result?.statusDetail ?? 'Den lokala insamlingen har inte körts ännu.',
      menuDate: result?.menuDate ?? null,
      dishes: result?.status === 'confirmed_today' ? result.dishes : [],
      lastRetrievalAttempt: preview?.lastAttempt ?? null,
      lastSuccessfulRetrieval: preview?.lastSuccess ?? null,
      retrievedAt: result?.retrievedAt ?? null,
      sourceUrl: result?.sourceUrl ?? restaurant.menuSourceUrl,
    };
  });
  const confirmed = responseRestaurants.filter(
    (restaurant) => restaurant.status === 'confirmed_today',
  ).length;
  return dashboardResponseSchema.parse({
    date,
    timeZone: STOCKHOLM_TIME_ZONE,
    generatedAt: new Date().toISOString(),
    target: TARGET_LOCATION,
    restaurants: responseRestaurants,
    summary: {
      total: responseRestaurants.length,
      confirmed,
      unavailable: responseRestaurants.length - confirmed,
    },
  });
}

await refresh();

const server = createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/api/v1/lunch') {
    response.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    });
    response.end(JSON.stringify(dashboardPayload()));
    return;
  }
  if (request.method === 'POST' && request.url === '/api/v1/refresh') {
    void refresh();
    response.writeHead(202, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ status: 'refresh_started' }));
    return;
  }
  if (
    request.method === 'GET' &&
    (request.url === '/health/live' || request.url === '/health/ready')
  ) {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(
      JSON.stringify({
        status: 'ok',
        mode: 'local-live-preview',
        sourcesCollected: results.size,
      }),
    );
    return;
  }
  response.writeHead(404, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ error: 'not_found' }));
});

server.listen(PORT, '127.0.0.1', () => {
  logger.log('info', {
    event: 'local_live_preview_ready',
    apiUrl: `http://127.0.0.1:${PORT}`,
  });
});

const refreshTimer = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
refreshTimer.unref();

function shutdown(signal: string): void {
  logger.log('info', { event: 'local_live_preview_shutdown', signal });
  clearInterval(refreshTimer);
  server.close(() => process.exit(0));
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
