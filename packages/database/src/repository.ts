import { randomUUID } from 'node:crypto';

import {
  STOCKHOLM_TIME_ZONE,
  TARGET_LOCATION,
  collectionResultSchema,
  dashboardResponseSchema,
  restaurantSchema,
  type CollectionResult,
  type DashboardResponse,
  type MenuStatus,
  type Restaurant,
} from '@lunch/shared';
import type pg from 'pg';

interface RestaurantRow {
  id: string;
  slug: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distance_meters: number;
  website_url: string;
  menu_source_url: string;
  menu_source_type: Restaurant['menuSourceType'];
  adapter: string;
  enabled: boolean;
}

interface DashboardRow extends RestaurantRow {
  status: MenuStatus | null;
  status_detail: string | null;
  menu_date: string | null;
  dishes: unknown;
  last_retrieval_attempt: Date | string | null;
  last_successful_retrieval: Date | string | null;
  retrieved_at: Date | string | null;
  source_url: string | null;
}

export interface SaveCollectionAttemptInput {
  restaurant: Restaurant;
  targetDate: string;
  startedAt: string;
  finishedAt: string;
  result: CollectionResult;
  errorCategory?: string;
  runId?: string;
}

export interface RunSummary {
  id: string;
  targetDate: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  attemptedCount: number;
  successfulCount: number;
  failedCount: number;
  summary: unknown;
}

export interface StartCollectionRunInput {
  targetDate: string;
  requestedRestaurantSlug?: string;
  startedAt: string;
}

export interface FinishCollectionRunInput {
  runId: string;
  finishedAt: string;
  status: 'completed' | 'partial_failure' | 'failed';
  attemptedCount: number;
  successfulCount: number;
  failedCount: number;
  summary: unknown;
}

function iso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toRestaurant(row: RestaurantRow): Restaurant {
  return restaurantSchema.parse({
    id: row.id,
    slug: row.slug,
    name: row.name,
    address: row.address,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    distanceMeters: row.distance_meters,
    websiteUrl: row.website_url,
    menuSourceUrl: row.menu_source_url,
    menuSourceType: row.menu_source_type,
    adapter: row.adapter,
    enabled: row.enabled,
  });
}

export class LunchRepository {
  constructor(private readonly pool: pg.Pool) {}

  async ping(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async listEnabledRestaurants(): Promise<Restaurant[]> {
    const result = await this.pool.query<RestaurantRow>(
      `SELECT id, slug, name, address, latitude, longitude, distance_meters,
              website_url, menu_source_url, menu_source_type, adapter, enabled
       FROM restaurants
       WHERE enabled = true
       ORDER BY distance_meters, name`,
    );
    return result.rows.map(toRestaurant);
  }

  async findRestaurantBySlug(slug: string): Promise<Restaurant | undefined> {
    const result = await this.pool.query<RestaurantRow>(
      `SELECT id, slug, name, address, latitude, longitude, distance_meters,
              website_url, menu_source_url, menu_source_type, adapter, enabled
       FROM restaurants
       WHERE slug = $1`,
      [slug],
    );
    return result.rows[0] ? toRestaurant(result.rows[0]) : undefined;
  }

  async getDashboard(date: string): Promise<DashboardResponse> {
    const result = await this.pool.query<DashboardRow>(
      `SELECT r.id, r.slug, r.name, r.address, r.latitude, r.longitude,
              r.distance_meters, r.website_url, r.menu_source_url,
              r.menu_source_type, r.adapter, r.enabled,
              ms.status, ms.status_detail, ms.menu_date::text, ms.dishes,
              r.last_retrieval_attempt, r.last_successful_retrieval,
              ms.retrieved_at, COALESCE(ms.source_url, r.menu_source_url) AS source_url
       FROM restaurants r
       LEFT JOIN menu_snapshots ms
         ON ms.restaurant_id = r.id AND ms.menu_date = $1::date
       WHERE r.enabled = true
       ORDER BY r.distance_meters, r.name`,
      [date],
    );

    const restaurants = result.rows.map((row) => {
      const status = row.status ?? 'not_published';
      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        address: row.address,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        distanceMeters: row.distance_meters,
        websiteUrl: row.website_url,
        menuSourceUrl: row.menu_source_url,
        menuSourceType: row.menu_source_type,
        status,
        statusDetail:
          row.status_detail ??
          (row.status === null
            ? 'No collection result exists for this date.'
            : undefined),
        menuDate: row.menu_date,
        dishes:
          status === 'confirmed_today' && Array.isArray(row.dishes) ? row.dishes : [],
        lastRetrievalAttempt: iso(row.last_retrieval_attempt),
        lastSuccessfulRetrieval: iso(row.last_successful_retrieval),
        retrievedAt: iso(row.retrieved_at),
        sourceUrl: row.source_url ?? row.menu_source_url,
      };
    });
    const confirmed = restaurants.filter(
      (restaurant) => restaurant.status === 'confirmed_today',
    ).length;

    return dashboardResponseSchema.parse({
      date,
      timeZone: STOCKHOLM_TIME_ZONE,
      generatedAt: new Date().toISOString(),
      target: TARGET_LOCATION,
      restaurants,
      summary: {
        total: restaurants.length,
        confirmed,
        unavailable: restaurants.length - confirmed,
      },
    });
  }

  async saveCollectionAttempt(input: SaveCollectionAttemptInput): Promise<void> {
    const result = collectionResultSchema.parse(input.result);
    const client = await this.pool.connect();
    const attemptId = randomUUID();
    const snapshotId = randomUUID();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO collection_attempts (
           id, run_id, restaurant_id, target_date, started_at, finished_at, status,
           error_category, status_detail, source_url, source_hash, raw_excerpt
         ) VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          attemptId,
          input.runId ?? null,
          input.restaurant.id,
          input.targetDate,
          input.startedAt,
          input.finishedAt,
          result.status,
          input.errorCategory ?? null,
          result.statusDetail ?? null,
          result.sourceUrl,
          result.sourceHash ?? null,
          result.rawExcerpt ?? null,
        ],
      );
      await client.query(
        `INSERT INTO menu_snapshots (
           id, restaurant_id, menu_date, status, status_detail, dishes, source_url,
           retrieved_at, source_hash, raw_excerpt
         ) VALUES ($1, $2, $3::date, $4, $5, $6::jsonb, $7, $8, $9, $10)
         ON CONFLICT (restaurant_id, menu_date) DO UPDATE SET
           status = EXCLUDED.status,
           status_detail = EXCLUDED.status_detail,
           dishes = EXCLUDED.dishes,
           source_url = EXCLUDED.source_url,
           retrieved_at = EXCLUDED.retrieved_at,
           source_hash = EXCLUDED.source_hash,
           raw_excerpt = EXCLUDED.raw_excerpt,
           updated_at = now()`,
        [
          snapshotId,
          input.restaurant.id,
          input.targetDate,
          result.status,
          result.statusDetail ?? null,
          JSON.stringify(result.dishes),
          result.sourceUrl,
          result.retrievedAt,
          result.sourceHash ?? null,
          result.rawExcerpt ?? null,
        ],
      );
      await client.query(
        `UPDATE restaurants SET
           last_retrieval_attempt = $2,
           last_successful_retrieval = CASE
             WHEN $3 = 'confirmed_today' THEN $2
             ELSE last_successful_retrieval
           END,
           current_menu_status = $3,
           status_detail = $4,
           updated_at = now()
         WHERE id = $1`,
        [
          input.restaurant.id,
          input.finishedAt,
          result.status,
          result.statusDetail ?? null,
        ],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async startCollectionRun(input: StartCollectionRunInput): Promise<string> {
    const id = randomUUID();
    await this.pool.query(
      `INSERT INTO collection_runs (
         id, target_date, started_at, requested_restaurant_slug, status
       ) VALUES ($1, $2::date, $3, $4, 'running')`,
      [id, input.targetDate, input.startedAt, input.requestedRestaurantSlug ?? null],
    );
    return id;
  }

  async finishCollectionRun(input: FinishCollectionRunInput): Promise<void> {
    await this.pool.query(
      `UPDATE collection_runs SET
         finished_at = $2,
         status = $3,
         attempted_count = $4,
         successful_count = $5,
         failed_count = $6,
         summary = $7::jsonb
       WHERE id = $1`,
      [
        input.runId,
        input.finishedAt,
        input.status,
        input.attemptedCount,
        input.successfulCount,
        input.failedCount,
        JSON.stringify(input.summary),
      ],
    );
  }

  async latestStatuses(): Promise<
    Array<{
      slug: string;
      name: string;
      status: MenuStatus;
      lastAttempt: string | null;
      lastSuccess: string | null;
    }>
  > {
    const result = await this.pool.query<{
      slug: string;
      name: string;
      current_menu_status: MenuStatus;
      last_retrieval_attempt: Date | null;
      last_successful_retrieval: Date | null;
    }>(
      `SELECT slug, name, current_menu_status, last_retrieval_attempt,
              last_successful_retrieval
       FROM restaurants WHERE enabled = true ORDER BY distance_meters, name`,
    );
    return result.rows.map((row) => ({
      slug: row.slug,
      name: row.name,
      status: row.current_menu_status,
      lastAttempt: iso(row.last_retrieval_attempt),
      lastSuccess: iso(row.last_successful_retrieval),
    }));
  }

  async recentFailures(limit = 25): Promise<
    Array<{
      slug: string;
      targetDate: string;
      finishedAt: string;
      status: MenuStatus;
      errorCategory: string | null;
      detail: string | null;
    }>
  > {
    const result = await this.pool.query<{
      slug: string;
      target_date: string;
      finished_at: Date;
      status: MenuStatus;
      error_category: string | null;
      status_detail: string | null;
    }>(
      `SELECT r.slug, ca.target_date::text, ca.finished_at, ca.status,
              ca.error_category, ca.status_detail
       FROM collection_attempts ca
       JOIN restaurants r ON r.id = ca.restaurant_id
       WHERE ca.status IN ('extraction_failed', 'manual_review')
       ORDER BY ca.finished_at DESC LIMIT $1`,
      [Math.max(1, Math.min(limit, 200))],
    );
    return result.rows.map((row) => ({
      slug: row.slug,
      targetDate: row.target_date,
      finishedAt: row.finished_at.toISOString(),
      status: row.status,
      errorCategory: row.error_category,
      detail: row.status_detail,
    }));
  }

  async latestRunSummary(): Promise<RunSummary | null> {
    const result = await this.pool.query<{
      id: string;
      target_date: string;
      started_at: Date;
      finished_at: Date | null;
      status: string;
      attempted_count: number;
      successful_count: number;
      failed_count: number;
      summary: unknown;
    }>(
      `SELECT id, target_date::text, started_at, finished_at, status,
              attempted_count, successful_count, failed_count, summary
       FROM collection_runs ORDER BY started_at DESC LIMIT 1`,
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      targetDate: row.target_date,
      startedAt: row.started_at.toISOString(),
      finishedAt: row.finished_at?.toISOString() ?? null,
      status: row.status,
      attemptedCount: row.attempted_count,
      successfulCount: row.successful_count,
      failedCount: row.failed_count,
      summary: row.summary,
    };
  }
}

export class PostgresRunLock {
  constructor(private readonly pool: pg.Pool) {}

  async tryAcquire(name: string): Promise<{ release: () => Promise<void> } | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query<{ acquired: boolean }>(
        'SELECT pg_try_advisory_lock(hashtext($1)) AS acquired',
        [name],
      );
      if (!result.rows[0]?.acquired) {
        client.release();
        return null;
      }
      let released = false;
      return {
        release: async () => {
          if (released) return;
          released = true;
          try {
            await client.query('SELECT pg_advisory_unlock(hashtext($1))', [name]);
          } finally {
            client.release();
          }
        },
      };
    } catch (error) {
      client.release();
      throw error;
    }
  }
}
