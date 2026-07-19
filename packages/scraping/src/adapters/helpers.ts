import { load, type CheerioAPI } from 'cheerio';

import { normalizeDish, sourceContentHash, stockholmWeekday } from '@lunch/shared';

import { CollectionError } from '../errors.js';
import type { FetchTextResponse } from '../http.js';

const WEEKDAYS = [
  'Söndag',
  'Måndag',
  'Tisdag',
  'Onsdag',
  'Torsdag',
  'Fredag',
  'Lördag',
] as const;

export function loadOfficialHtml(response: FetchTextResponse): CheerioAPI {
  if (!['text/html', 'application/xhtml+xml'].includes(response.contentType)) {
    throw new CollectionError(
      'unsupported_content_type',
      `Expected official HTML, received ${response.contentType}`,
    );
  }
  try {
    return load(response.body);
  } catch (error) {
    throw new CollectionError(
      'parse',
      'The official page HTML could not be parsed',
      false,
      {
        cause: error,
      },
    );
  }
}

export function weekdayNameForDate(date: string): string {
  const weekday = WEEKDAYS[stockholmWeekday(date)];
  if (!weekday) {
    throw new CollectionError('configuration', `Invalid target date: ${date}`);
  }
  return weekday;
}

export function isWeekend(date: string): boolean {
  return [0, 6].includes(stockholmWeekday(date));
}

export function cleanText(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function uniqueText(values: string[]): string[] {
  return [...new Set(values.map(cleanText).filter(Boolean))];
}

export function normalizeDishLines(lines: string[]) {
  return uniqueText(lines).map((name) => normalizeDish({ name }));
}

export function excerpt(lines: string[]): string | undefined {
  const value = uniqueText(lines).join('\n').slice(0, 20_000);
  return value || undefined;
}

export function hashResponse(response: FetchTextResponse): string {
  return sourceContentHash(response.body);
}

export function textOf($: CheerioAPI, elements: ReturnType<CheerioAPI>): string[] {
  return elements
    .toArray()
    .map((element) => cleanText($(element).text()))
    .filter(Boolean);
}

export function matchesWeekdayHeading(value: string, weekday: string): boolean {
  return (
    cleanText(value).toLocaleLowerCase('sv-SE') === weekday.toLocaleLowerCase('sv-SE')
  );
}
