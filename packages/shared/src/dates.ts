import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

import { STOCKHOLM_TIME_ZONE } from './contracts.js';

const SWEDISH_WEEKDAYS: Record<string, number> = {
  måndag: 1,
  mandag: 1,
  mån: 1,
  tisdag: 2,
  tis: 2,
  onsdag: 3,
  ons: 3,
  torsdag: 4,
  tors: 4,
  fredag: 5,
  fre: 5,
  lördag: 6,
  lordag: 6,
  lör: 6,
  lor: 6,
  söndag: 0,
  sondag: 0,
  sön: 0,
  son: 0,
};

export function stockholmDate(now: Date = new Date()): string {
  return formatInTimeZone(now, STOCKHOLM_TIME_ZONE, 'yyyy-MM-dd');
}

export function stockholmWeekday(date: string): number {
  const noonUtc = fromZonedTime(`${date} 12:00:00`, STOCKHOLM_TIME_ZONE);
  return Number(formatInTimeZone(noonUtc, STOCKHOLM_TIME_ZONE, 'i')) % 7;
}

export function recognizeSwedishWeekday(value: string): number | undefined {
  const normalized = value.toLocaleLowerCase('sv-SE').replace(/[.,:]/g, '').trim();
  return SWEDISH_WEEKDAYS[normalized];
}

export function weekdayMatchesDate(weekday: string, date: string): boolean {
  const recognized = recognizeSwedishWeekday(weekday);
  return recognized !== undefined && recognized === stockholmWeekday(date);
}

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}
