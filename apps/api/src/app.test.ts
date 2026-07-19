import {
  PRODUCT_RADIUS_METERS,
  STOCKHOLM_TIME_ZONE,
  type DashboardResponse,
} from '@lunch/shared';
import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from './app.js';

function response(date: string): DashboardResponse {
  return {
    date,
    timeZone: STOCKHOLM_TIME_ZONE,
    generatedAt: '2026-07-19T08:00:00.000Z',
    target: {
      name: 'Places Telefonplan – Coworking',
      address: 'Tellusgången 2, 126 26 Hägersten, Sweden',
      latitude: 59.29927,
      longitude: 17.994293,
      radiusMeters: PRODUCT_RADIUS_METERS,
    },
    restaurants: [],
    summary: { total: 0, confirmed: 0, unavailable: 0 },
  };
}

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('HTTP API', () => {
  it('uses the Stockholm calendar date by default', async () => {
    let requestedDate = '';
    const app = await buildApp({
      logger: false,
      now: () => new Date('2026-07-18T22:30:00.000Z'),
      repository: {
        ping: async () => undefined,
        getDashboard: async (date) => {
          requestedDate = date;
          return response(date);
        },
      },
    });
    apps.push(app);

    const result = await app.inject({ method: 'GET', url: '/api/v1/lunch' });

    expect(result.statusCode).toBe(200);
    expect(requestedDate).toBe('2026-07-19');
    expect(result.json()).toMatchObject({
      date: '2026-07-19',
      timeZone: 'Europe/Stockholm',
    });
  });

  it('accepts a valid reprocessed date and rejects malformed input', async () => {
    const app = await buildApp({
      logger: false,
      repository: {
        ping: async () => undefined,
        getDashboard: async (date) => response(date),
      },
    });
    apps.push(app);

    const valid = await app.inject({
      method: 'GET',
      url: '/api/v1/lunch?date=2026-07-17',
    });
    const invalid = await app.inject({
      method: 'GET',
      url: '/api/v1/lunch?date=17-07-2026',
    });

    expect(valid.statusCode).toBe(200);
    expect(valid.json()).toMatchObject({ date: '2026-07-17' });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json()).toMatchObject({ error: 'invalid_request' });
  });

  it('exposes separate liveness and database readiness', async () => {
    const app = await buildApp({
      logger: false,
      repository: {
        ping: async () => {
          throw new Error('database unavailable');
        },
        getDashboard: async (date) => response(date),
      },
    });
    apps.push(app);

    const live = await app.inject({ method: 'GET', url: '/health/live' });
    const ready = await app.inject({ method: 'GET', url: '/health/ready' });

    expect(live.statusCode).toBe(200);
    expect(ready.statusCode).toBe(503);
    expect(ready.json()).toEqual({ status: 'not_ready' });
  });
});
