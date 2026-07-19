import {
  AdapterRegistry,
  CollectionError,
  nullLogger,
  type FetchTextClient,
  type MenuAdapter,
} from '@lunch/scraping';
import type { CollectionResult, Restaurant } from '@lunch/shared';
import { describe, expect, it } from 'vitest';

import type {
  RunLock,
  SaveCollectionAttemptInput,
  WorkerRepository,
} from '../src/contracts.js';
import { runCollection } from '../src/run.js';

function restaurant(slug: string, adapter: string, idSuffix: string): Restaurant {
  return {
    id: `00000000-0000-4000-8000-${idSuffix.padStart(12, '0')}`,
    slug,
    name: slug,
    address: 'Tellusgången 2, Hägersten',
    latitude: 59.298,
    longitude: 17.995,
    distanceMeters: 100,
    websiteUrl: `https://${slug}.example.com/`,
    menuSourceUrl: `https://${slug}.example.com/lunch`,
    menuSourceType: 'html',
    enabled: true,
    adapter,
  };
}

class FakeRepository implements WorkerRepository {
  readonly saved: SaveCollectionAttemptInput[] = [];
  readonly restaurants = [
    restaurant('working-source', 'working', '1'),
    restaurant('broken-source', 'broken', '2'),
  ];

  async listEnabledRestaurants() {
    return this.restaurants;
  }

  async findRestaurantBySlug(slug: string) {
    return this.restaurants.find((item) => item.slug === slug);
  }

  async saveCollectionAttempt(input: SaveCollectionAttemptInput) {
    this.saved.push(input);
  }

  async latestStatuses() {
    return [];
  }

  async recentFailures() {
    return [];
  }

  async latestRunSummary() {
    return null;
  }
}

const availableAdapter: MenuAdapter = {
  id: 'working',
  extract: async ({ restaurant, targetDate }) => ({
    dishes: [{ name: 'Verified fixture dish', dietary: [] }],
    availability: 'menu',
    temporal: { dates: [targetDate] },
    sourceUrl: restaurant.menuSourceUrl,
    retrievedAt: `${targetDate}T06:15:00.000Z`,
  }),
};

const brokenAdapter: MenuAdapter = {
  id: 'broken',
  extract: async () => {
    throw new CollectionError('parse', 'Fixture source changed shape');
  },
};

const unusedHttp: FetchTextClient = {
  get: async () => {
    throw new Error('Adapters in this test do not fetch');
  },
};

function lock(acquired = true): RunLock {
  return {
    tryAcquire: async () => (acquired ? { release: async () => undefined } : null),
  };
}

describe('collection run isolation', () => {
  it('continues and persists other restaurants when one adapter fails', async () => {
    const repository = new FakeRepository();
    const summary = await runCollection({
      repository,
      lock: lock(),
      logger: nullLogger,
      targetDate: '2026-08-10',
      registry: new AdapterRegistry([availableAdapter, brokenAdapter]),
      http: unusedHttp,
      concurrency: 2,
    });

    expect(summary.status).toBe('partial_failure');
    expect(summary.attemptedCount).toBe(2);
    expect(summary.successfulCount).toBe(1);
    expect(summary.failedCount).toBe(1);
    expect(repository.saved).toHaveLength(2);
    expect(
      repository.saved.find((item) => item.restaurant.slug === 'working-source')?.result
        .status,
    ).toBe('confirmed_today');
    expect(
      repository.saved.find((item) => item.restaurant.slug === 'broken-source')?.result
        .status,
    ).toBe('extraction_failed');
  });

  it('skips without touching restaurants when the global run lock is held', async () => {
    const repository = new FakeRepository();
    const summary = await runCollection({
      repository,
      lock: lock(false),
      logger: nullLogger,
      targetDate: '2026-08-10',
      registry: new AdapterRegistry([availableAdapter, brokenAdapter]),
      http: unusedHttp,
    });

    expect(summary.status).toBe('skipped_overlap');
    expect(summary.attemptedCount).toBe(0);
    expect(repository.saved).toEqual([]);
  });
});
