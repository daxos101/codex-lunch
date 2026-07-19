import {
  recognizeSwedishWeekday,
  stockholmDate,
  weekdayMatchesDate,
} from '@lunch/shared';
import { describe, expect, it } from 'vitest';

import { classifyExtraction } from '../src/freshness.js';

describe('freshness evidence', () => {
  it.each([
    ['Måndag', 1],
    ['tis.', 2],
    ['Onsdag:', 3],
    ['tors', 4],
    ['FREDAG', 5],
    ['lör', 6],
    ['Sondag', 0],
  ])('recognizes Swedish weekday %s', (value, expected) => {
    expect(recognizeSwedishWeekday(value)).toBe(expected);
  });

  it('matches Swedish weekday evidence against the Stockholm date', () => {
    expect(weekdayMatchesDate('måndag', '2026-08-10')).toBe(true);
    expect(weekdayMatchesDate('tisdag', '2026-08-10')).toBe(false);
  });

  it('uses Stockholm local dates across standard and daylight-saving time', () => {
    expect(stockholmDate(new Date('2026-01-01T23:30:00.000Z'))).toBe('2026-01-02');
    expect(stockholmDate(new Date('2026-07-19T22:30:00.000Z'))).toBe('2026-07-20');
  });

  it('requires stronger evidence when reprocessing an older date', () => {
    const result = classifyExtraction(
      {
        dishes: [{ name: 'A source-provided dish', dietary: [] }],
        availability: 'menu',
        temporal: { weekdays: ['Måndag'] },
        sourceUrl: 'https://example.com/menu',
        retrievedAt: '2026-08-17T06:15:00.000Z',
      },
      '2026-08-10',
    );

    expect(result.status).toBe('possibly_stale');
    expect(result.dishes).toEqual([]);
  });

  it('sends conflicting date evidence to manual review', () => {
    const result = classifyExtraction(
      {
        dishes: [{ name: 'A source-provided dish', dietary: [] }],
        availability: 'menu',
        temporal: { dates: ['2026-08-10', '2026-08-11'] },
        sourceUrl: 'https://example.com/menu',
        retrievedAt: '2026-08-10T06:15:00.000Z',
      },
      '2026-08-10',
    );

    expect(result.status).toBe('manual_review');
    expect(result.menuDate).toBeNull();
  });
});
