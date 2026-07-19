import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  TARGET_LOCATION,
  restaurantSchema,
  roundedDistanceMeters,
} from '@lunch/shared';

import { createPool } from './client.js';

interface SeedDocument {
  restaurants: unknown[];
}

export async function seed(
  seedPath = process.env.RESTAURANT_SEED_PATH ??
    resolve(process.cwd(), 'data/restaurants.json'),
): Promise<void> {
  const document = JSON.parse(await readFile(seedPath, 'utf8')) as SeedDocument;
  const restaurants = document.restaurants.map((value) =>
    restaurantSchema.parse(value),
  );
  for (const restaurant of restaurants) {
    const calculatedDistance = roundedDistanceMeters(TARGET_LOCATION, restaurant);
    if (calculatedDistance !== restaurant.distanceMeters) {
      throw new Error(
        `${restaurant.slug}: stored distance ${restaurant.distanceMeters}m does not match Haversine result ${calculatedDistance}m`,
      );
    }
  }
  const pool = createPool({ applicationName: 'hagersten-lunch-seed' });
  try {
    for (const restaurant of restaurants) {
      await pool.query(
        `INSERT INTO restaurants (
           id, slug, name, address, latitude, longitude, distance_meters,
           website_url, menu_source_url, menu_source_type, adapter, enabled
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO UPDATE SET
           slug = EXCLUDED.slug,
           name = EXCLUDED.name,
           address = EXCLUDED.address,
           latitude = EXCLUDED.latitude,
           longitude = EXCLUDED.longitude,
           distance_meters = EXCLUDED.distance_meters,
           website_url = EXCLUDED.website_url,
           menu_source_url = EXCLUDED.menu_source_url,
           menu_source_type = EXCLUDED.menu_source_type,
           adapter = EXCLUDED.adapter,
           enabled = EXCLUDED.enabled,
           updated_at = now()`,
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
    }
    process.stdout.write(
      `${JSON.stringify({
        level: 'info',
        event: 'restaurants_seeded',
        count: restaurants.length,
      })}\n`,
    );
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed().catch((error: unknown) => {
    process.stderr.write(
      `${JSON.stringify({
        level: 'error',
        event: 'seed_failed',
        error: error instanceof Error ? error.message : String(error),
      })}\n`,
    );
    process.exitCode = 1;
  });
}
