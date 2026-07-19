import { readFile } from 'node:fs/promises';

import { type CollectionResult, type Restaurant } from '@lunch/shared';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createPool } from './client.js';
import { LunchRepository } from './repository.js';

const connectionString = process.env.TEST_DATABASE_URL;
const integration = describe.runIf(Boolean(connectionString));

integration('PostgreSQL repository', () => {
  let pool: pg.Pool;
  let repository: LunchRepository;

  const restaurant: Restaurant = {
    id: '018fc7af-4777-7e4d-ae3f-4f51e9eac123',
    slug: 'fixture-kitchen',
    name: 'Fixture Kitchen',
    address: 'Testgatan 1, Hägersten',
    latitude: 59.29927,
    longitude: 17.994293,
    distanceMeters: 50,
    websiteUrl: 'https://example.com',
    menuSourceUrl: 'https://example.com/lunch',
    menuSourceType: 'html',
    adapter: 'fixture',
    enabled: true,
  };

  beforeAll(async () => {
    pool = createPool({
      connectionString,
      applicationName: 'hagersten-lunch-database-test',
    });
    repository = new LunchRepository(pool);
    const migration = await readFile(
      new URL('../migrations/0001_initial.sql', import.meta.url),
      'utf8',
    );
    await pool.query(migration);
  });

  beforeEach(async () => {
    await pool.query(
      'TRUNCATE collection_attempts, menu_snapshots, collection_runs, restaurants CASCADE',
    );
    await pool.query(
      `INSERT INTO restaurants (
         id, slug, name, address, latitude, longitude, distance_meters,
         website_url, menu_source_url, menu_source_type, adapter, enabled
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        restaurant.id,
        restaurant.slug,
        restaurant.name,
        restaurant.address,
        restaurant.latitude,
        restaurant.longitude,
        restaurant.distanceMeters,
        restaurant.websiteUrl,
        restaurant.menuSourceUrl,
        restaurant.menuSourceType,
        restaurant.adapter,
        restaurant.enabled,
      ],
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  it('keeps one date snapshot while retaining every collection attempt', async () => {
    const result: CollectionResult = {
      status: 'confirmed_today',
      menuDate: '2026-07-19',
      dishes: [{ name: 'Bakad rotselleri', dietary: ['vegetarian'] }],
      sourceUrl: restaurant.menuSourceUrl,
      retrievedAt: '2026-07-19T06:15:00.000Z',
      sourceHash: 'hash-one',
    };

    await repository.saveCollectionAttempt({
      restaurant,
      targetDate: '2026-07-19',
      startedAt: '2026-07-19T06:14:58.000Z',
      finishedAt: '2026-07-19T06:15:00.000Z',
      result,
    });
    await repository.saveCollectionAttempt({
      restaurant,
      targetDate: '2026-07-19',
      startedAt: '2026-07-19T06:19:58.000Z',
      finishedAt: '2026-07-19T06:20:00.000Z',
      result: { ...result, retrievedAt: '2026-07-19T06:20:00.000Z' },
    });

    const snapshots = await pool.query(
      'SELECT count(*)::int AS count FROM menu_snapshots',
    );
    const attempts = await pool.query(
      'SELECT count(*)::int AS count FROM collection_attempts',
    );
    const dashboard = await repository.getDashboard('2026-07-19');

    expect(snapshots.rows[0].count).toBe(1);
    expect(attempts.rows[0].count).toBe(2);
    expect(dashboard.restaurants[0]).toMatchObject({
      status: 'confirmed_today',
      dishes: [{ name: 'Bakad rotselleri' }],
    });
  });

  it('never exposes stale dishes as today even if extraction found text', async () => {
    await repository.saveCollectionAttempt({
      restaurant,
      targetDate: '2026-07-19',
      startedAt: '2026-07-19T06:14:58.000Z',
      finishedAt: '2026-07-19T06:15:00.000Z',
      result: {
        status: 'possibly_stale',
        statusDetail: 'Source was headed Friday, not Sunday.',
        menuDate: '2026-07-17',
        dishes: [{ name: 'Old dish', dietary: [] }],
        sourceUrl: restaurant.menuSourceUrl,
        retrievedAt: '2026-07-19T06:15:00.000Z',
      },
    });

    const dashboard = await repository.getDashboard('2026-07-19');

    expect(dashboard.restaurants[0]).toMatchObject({
      status: 'possibly_stale',
      dishes: [],
    });
  });
});
