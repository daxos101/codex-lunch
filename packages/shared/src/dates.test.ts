import { describe, expect, it } from 'vitest';

import { recognizeSwedishWeekday, stockholmDate, weekdayMatchesDate } from './dates.js';

describe('Stockholm date handling', () => {
  it('crosses midnight independently of UTC', () => {
    expect(stockholmDate(new Date('2026-07-18T22:30:00Z'))).toBe('2026-07-19');
  });

  it('handles the winter UTC offset', () => {
    expect(stockholmDate(new Date('2026-01-31T23:30:00Z'))).toBe('2026-02-01');
  });
});

describe('Swedish weekday recognition', () => {
  it.each([
    ['måndag', 1],
    ['MÅN.', 1],
    ['tisdag', 2],
    ['ons', 3],
    ['torsdag:', 4],
    ['fre', 5],
    ['lördag', 6],
    ['söndag', 0],
  ])('recognizes %s', (input, expected) => {
    expect(recognizeSwedishWeekday(input)).toBe(expected);
  });

  it('does not guess unknown weekday text', () => {
    expect(recognizeSwedishWeekday('lunch idag')).toBeUndefined();
  });

  it('matches the weekday to an explicit Stockholm date', () => {
    expect(weekdayMatchesDate('söndag', '2026-07-19')).toBe(true);
    expect(weekdayMatchesDate('måndag', '2026-07-19')).toBe(false);
  });
});
