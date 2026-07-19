import type { Restaurant } from '@lunch/shared';
import { stockholmDate } from '@lunch/shared';
import { describe, expect, it } from 'vitest';

import { collectRestaurant } from '../src/collector.js';
import { BoundedFetchClient } from '../src/http.js';
import { nullLogger } from '../src/logger.js';
import { createDefaultAdapterRegistry } from '../src/registry.js';

const live = process.env['LUNCH_LIVE_CHECK'] === '1';

const sources: Array<
  Pick<Restaurant, 'slug' | 'name' | 'menuSourceUrl' | 'websiteUrl' | 'adapter'>
> = [
  {
    slug: 'addfood',
    name: 'Addfood',
    websiteUrl: 'https://www.addfood.se/',
    menuSourceUrl: 'https://www.addfood.se/home/lunchmeny/',
    adapter: 'addfood-weekly-html',
  },
  {
    slug: 'landet',
    name: 'Restaurang Landet',
    websiteUrl: 'https://www.landet.nu/',
    menuSourceUrl: 'https://www.landet.nu/lunch/',
    adapter: 'landet-daily-html',
  },
];

describe.skipIf(!live)('optional official-source smoke checks', () => {
  it.each(sources)('$slug still has a parseable public source', async (source) => {
    const restaurant: Restaurant = {
      id:
        source.slug === 'addfood'
          ? '00000000-0000-4000-8000-000000000001'
          : '00000000-0000-4000-8000-000000000002',
      ...source,
      address: 'Hägersten, Sweden',
      latitude: 59.298,
      longitude: 17.995,
      distanceMeters: 100,
      menuSourceType: 'html',
      enabled: true,
    };
    const outcome = await collectRestaurant({
      restaurant,
      targetDate: stockholmDate(),
      http: new BoundedFetchClient({
        retries: 1,
        timeoutMs: 12_000,
        minimumHostIntervalMs: 500,
      }),
      registry: createDefaultAdapterRegistry(),
      logger: nullLogger,
    });

    expect(outcome.result.status).not.toBe('extraction_failed');
    expect(outcome.result.sourceUrl).toMatch(/^https:\/\//);
  });
});
