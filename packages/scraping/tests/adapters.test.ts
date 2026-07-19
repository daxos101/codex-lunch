import { readFile } from 'node:fs/promises';

import type { Restaurant } from '@lunch/shared';
import { describe, expect, it, vi } from 'vitest';

import { AddfoodWeeklyHtmlAdapter } from '../src/adapters/addfood.js';
import { LandetDailyHtmlAdapter } from '../src/adapters/landet.js';
import { ManualReviewAdapter } from '../src/adapters/manual-review.js';
import { classifyExtraction } from '../src/freshness.js';
import type { FetchTextClient, FetchTextResponse } from '../src/http.js';
import { nullLogger } from '../src/logger.js';

const ADD_FOOD_URL = 'https://www.addfood.se/home/lunchmeny/';
const LANDET_URL = 'https://www.landet.nu/lunch/';

function restaurant(overrides: Partial<Restaurant> = {}): Restaurant {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    slug: 'fixture-restaurant',
    name: 'Fixture Restaurant',
    address: 'Tellusgången 2, Hägersten',
    latitude: 59.298,
    longitude: 17.995,
    distanceMeters: 100,
    websiteUrl: 'https://example.com/',
    menuSourceUrl: ADD_FOOD_URL,
    menuSourceType: 'html',
    enabled: true,
    adapter: 'fixture',
    ...overrides,
  };
}

async function fixture(name: string): Promise<string> {
  return readFile(new URL(`fixtures/${name}`, import.meta.url), 'utf8');
}

function fixtureHttp(
  body: string,
  retrievedAt: string,
  finalUrl: string,
): FetchTextClient {
  const response: FetchTextResponse = {
    body,
    contentType: 'text/html',
    finalUrl,
    fromCache: false,
    retrievedAt,
    status: 200,
  };
  return { get: async () => response };
}

describe('official HTML adapters', () => {
  it('extracts and confirms Addfood dishes for the matching Swedish weekday and week', async () => {
    const html = await fixture('addfood-week-33.html');
    const adapter = new AddfoodWeeklyHtmlAdapter();
    const extraction = await adapter.extract({
      restaurant: restaurant({
        menuSourceUrl: ADD_FOOD_URL,
        adapter: adapter.id,
      }),
      targetDate: '2026-08-10',
      http: fixtureHttp(html, '2026-08-10T06:15:00.000Z', ADD_FOOD_URL),
      logger: nullLogger,
    });
    const result = classifyExtraction(extraction, '2026-08-10');

    expect(result.status).toBe('confirmed_today');
    expect(result.menuDate).toBe('2026-08-10');
    expect(result.dishes).toHaveLength(4);
    expect(result.dishes[3]?.dietary).toContain('vegetarian');
    expect(result.sourceUrl).toBe(ADD_FOOD_URL);
    expect(result.sourceHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('marks a previous Addfood week stale and withholds its dishes', async () => {
    const html = await fixture('addfood-week-33.html');
    const adapter = new AddfoodWeeklyHtmlAdapter();
    const extraction = await adapter.extract({
      restaurant: restaurant({
        menuSourceUrl: ADD_FOOD_URL,
        adapter: adapter.id,
      }),
      targetDate: '2026-08-17',
      http: fixtureHttp(html, '2026-08-17T06:15:00.000Z', ADD_FOOD_URL),
      logger: nullLogger,
    });
    const result = classifyExtraction(extraction, '2026-08-17');

    expect(result.status).toBe('possibly_stale');
    expect(result.menuDate).toBeNull();
    expect(result.dishes).toEqual([]);
  });

  it('recognizes Addfood vacation closure week ranges outside the dish section', async () => {
    const html = await fixture('addfood-week-33.html');
    const adapter = new AddfoodWeeklyHtmlAdapter();
    const extraction = await adapter.extract({
      restaurant: restaurant({
        menuSourceUrl: ADD_FOOD_URL,
        adapter: adapter.id,
      }),
      targetDate: '2026-07-20',
      http: fixtureHttp(html, '2026-07-20T06:15:00.000Z', ADD_FOOD_URL),
      logger: nullLogger,
    });
    const result = classifyExtraction(extraction, '2026-07-20');

    expect(result.status).toBe('closed');
    expect(result.rawExcerpt).toBe('Sommarstängt v29-32');
    expect(result.dishes).toEqual([]);
  });

  it('recognizes Landet explicitly closing lunch for the target weekday', async () => {
    const html = await fixture('landet-summer-closed.html');
    const adapter = new LandetDailyHtmlAdapter();
    const extraction = await adapter.extract({
      restaurant: restaurant({
        menuSourceUrl: LANDET_URL,
        adapter: adapter.id,
      }),
      targetDate: '2026-07-20',
      http: fixtureHttp(html, '2026-07-20T06:15:00.000Z', LANDET_URL),
      logger: nullLogger,
    });
    const result = classifyExtraction(extraction, '2026-07-20');

    expect(result.status).toBe('closed');
    expect(result.dishes).toEqual([]);
    expect(result.rawExcerpt).toContain('Lunchen stängd!');
    expect(result.statusDetail).toContain('Åter 24e augusti.');
  });

  it('keeps manual sources visible without making a network request or inventing dishes', async () => {
    const get = vi.fn<FetchTextClient['get']>();
    const adapter = new ManualReviewAdapter();
    const extraction = await adapter.extract({
      restaurant: restaurant({
        menuSourceUrl: 'https://example.com/official-menu',
        adapter: adapter.id,
      }),
      targetDate: '2026-07-20',
      http: { get },
      logger: nullLogger,
    });
    const result = classifyExtraction(extraction, '2026-07-20');

    expect(get).not.toHaveBeenCalled();
    expect(result.status).toBe('manual_review');
    expect(result.dishes).toEqual([]);
    expect(result.statusDetail).toContain('requires manual review');
  });
});
