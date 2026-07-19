import { describe, expect, it } from 'vitest';

import { haversineMeters, roundedDistanceMeters } from './geo.js';

describe('geographic radius calculations', () => {
  it('returns zero for identical coordinates', () => {
    const point = { latitude: 59.29927, longitude: 17.994293 };
    expect(haversineMeters(point, point)).toBe(0);
  });

  it('matches a known one-degree great-circle distance', () => {
    const meters = haversineMeters(
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 1 },
    );
    expect(meters).toBeCloseTo(111_195.08, 0);
  });

  it('is symmetric and rounds only at the storage boundary', () => {
    const office = { latitude: 59.29927, longitude: 17.994293 };
    const restaurant = { latitude: 59.303, longitude: 18.001 };
    expect(haversineMeters(office, restaurant)).toBeCloseTo(
      haversineMeters(restaurant, office),
      8,
    );
    expect(roundedDistanceMeters(office, restaurant)).toBe(
      Math.round(haversineMeters(office, restaurant)),
    );
  });
});
