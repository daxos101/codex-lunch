import { describe, expect, it } from 'vitest';

import { readConfig } from './config.js';

describe('API configuration', () => {
  it('uses the hosting platform PORT when API_PORT is not set', () => {
    expect(
      readConfig({
        DATABASE_URL: 'postgresql://example.invalid/lunch',
        PORT: '10000',
      }).port,
    ).toBe(10_000);
  });

  it('prefers explicit API_PORT and parses the CORS allowlist', () => {
    const config = readConfig({
      DATABASE_URL: 'postgresql://example.invalid/lunch',
      PORT: '10000',
      API_PORT: '3001',
      CORS_ORIGINS: 'https://lunch.example, https://office.example ',
    });

    expect(config.port).toBe(3001);
    expect(config.allowedOrigins).toEqual([
      'https://lunch.example',
      'https://office.example',
    ]);
  });
});
