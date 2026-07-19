import type { CheerioAPI } from 'cheerio';
import { stockholmDate } from '@lunch/shared';

import { CollectionError } from '../errors.js';
import { getIsoWeek } from '../freshness.js';
import type { MenuAdapter } from '../types.js';
import {
  cleanText,
  excerpt,
  hashResponse,
  isWeekend,
  loadOfficialHtml,
  matchesWeekdayHeading,
  normalizeDishLines,
  textOf,
  weekdayNameForDate,
} from './helpers.js';

const CLOSED_PATTERN = /\b(?:sommar|semester)?stängt\b/i;
const CLOSED_WEEK_PATTERN =
  /\b(?:sommar|semester)stängt\s+v(?:ecka)?\s*(\d{1,2})(?:\s*[-–—]\s*(\d{1,2}))?/i;

function isWeekInRange(week: number, start: number, end: number): boolean {
  return start <= end ? week >= start && week <= end : week >= start || week <= end;
}

function findWeekdayLines(
  $: CheerioAPI,
  weekday: string,
): { lines: string[]; found: boolean } {
  const heading = $('h2')
    .filter((_, element) => matchesWeekdayHeading($(element).text(), weekday))
    .first();
  if (heading.length === 0) return { lines: [], found: false };

  const elementorColumn = heading.closest('.elementor-column');
  if (elementorColumn.length > 0) {
    const paragraphs = elementorColumn.find(
      '.elementor-widget-text-editor p, .elementor-widget-text-editor li',
    );
    return { lines: textOf($, paragraphs), found: true };
  }

  const lines: string[] = [];
  let current = heading.parent().next();
  while (current.length > 0 && !current.find('h2').addBack('h2').length) {
    const items = current.find('p, li');
    if (items.length > 0) lines.push(...textOf($, items));
    else {
      const value = cleanText(current.text());
      if (value) lines.push(value);
    }
    current = current.next();
  }
  return { lines, found: true };
}

function menuWeek($: CheerioAPI): number | undefined {
  const heading = $('h1, h2, h3')
    .toArray()
    .map((element) => cleanText($(element).text()))
    .find((value) => /lunchmeny\s+vecka/i.test(value));
  const match = heading?.match(/\bvecka\s*(\d{1,2})\b/i);
  return match?.[1] ? Number(match[1]) : undefined;
}

export class AddfoodWeeklyHtmlAdapter implements MenuAdapter {
  readonly id = 'addfood-weekly-html';

  async extract(input: Parameters<MenuAdapter['extract']>[0]) {
    const response = await input.http.get(input.restaurant.menuSourceUrl);
    const $ = loadOfficialHtml(response);
    const weekday = weekdayNameForDate(input.targetDate);
    const allPageText = cleanText($('body').text());
    const closedWeeks = allPageText.match(CLOSED_WEEK_PATTERN);
    const closedStart = closedWeeks?.[1] ? Number(closedWeeks[1]) : undefined;
    const closedEnd = closedWeeks?.[2] ? Number(closedWeeks[2]) : closedStart;
    const retrievalYear = stockholmDate(new Date(response.retrievedAt)).slice(0, 4);
    if (
      closedStart !== undefined &&
      closedEnd !== undefined &&
      retrievalYear === input.targetDate.slice(0, 4) &&
      isWeekInRange(getIsoWeek(input.targetDate), closedStart, closedEnd)
    ) {
      const closureText = cleanText(closedWeeks?.[0] ?? '');
      return {
        dishes: [],
        availability: 'closed' as const,
        temporal: { dates: [input.targetDate] },
        sourceUrl: response.finalUrl,
        retrievedAt: response.retrievedAt,
        rawExcerpt: closureText,
        sourceHash: hashResponse(response),
        detail: `The official source states: ${closureText}`,
      };
    }

    if (
      isWeekend(input.targetDate) &&
      /\bMåndag\s*[–—-]\s*Fredag\b/i.test(allPageText)
    ) {
      return {
        dishes: [],
        availability: 'closed' as const,
        temporal: { dates: [input.targetDate] },
        sourceUrl: response.finalUrl,
        retrievedAt: response.retrievedAt,
        rawExcerpt: 'Official lunch hours are Monday–Friday.',
        sourceHash: hashResponse(response),
        detail: 'The official source lists lunch service Monday–Friday.',
      };
    }

    const section = findWeekdayLines($, weekday);
    if (!section.found) {
      throw new CollectionError(
        'parse',
        `Could not find the ${weekday} section on Addfood's official lunch page`,
      );
    }
    const week = menuWeek($);
    if (week === undefined) {
      throw new CollectionError(
        'parse',
        'Could not find a numbered lunch week on Addfood’s official page',
      );
    }

    const isClosed = section.lines.some((line) => CLOSED_PATTERN.test(line));
    return {
      dishes: isClosed ? [] : normalizeDishLines(section.lines),
      availability: isClosed ? ('closed' as const) : ('menu' as const),
      temporal: { weekdays: [weekday], isoWeek: week },
      sourceUrl: response.finalUrl,
      retrievedAt: response.retrievedAt,
      rawExcerpt: excerpt(section.lines),
      sourceHash: hashResponse(response),
      ...(isClosed
        ? { detail: 'The official weekday section explicitly says lunch is closed.' }
        : {}),
    };
  }
}
