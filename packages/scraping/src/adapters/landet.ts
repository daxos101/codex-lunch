import { CollectionError } from '../errors.js';
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

const CLOSED_PATTERN = /\b(?:lunchen\s+)?stängd\b/i;

export class LandetDailyHtmlAdapter implements MenuAdapter {
  readonly id = 'landet-daily-html';

  async extract(input: Parameters<MenuAdapter['extract']>[0]) {
    const response = await input.http.get(input.restaurant.menuSourceUrl);
    const $ = loadOfficialHtml(response);
    const weekday = weekdayNameForDate(input.targetDate);
    const allPageText = cleanText($('body').text());

    if (isWeekend(input.targetDate) && /\bvarje\s+vardag\b/i.test(allPageText)) {
      return {
        dishes: [],
        availability: 'closed' as const,
        temporal: { dates: [input.targetDate] },
        sourceUrl: response.finalUrl,
        retrievedAt: response.retrievedAt,
        rawExcerpt: 'The official source describes lunch service every weekday.',
        sourceHash: hashResponse(response),
        detail: 'The official source describes lunch service on weekdays.',
      };
    }

    const day = $('#lunch-days > li')
      .filter((_, element) => {
        const heading = $(element).children('h2').first().text();
        return matchesWeekdayHeading(heading, weekday);
      })
      .first();
    if (day.length === 0) {
      throw new CollectionError(
        'parse',
        `Could not find the ${weekday} section on Landet's official lunch page`,
      );
    }

    const lines = textOf($, day.find('ul').first().children('li'));
    const isClosed = lines.some((line) => CLOSED_PATTERN.test(line));
    const dishLines = lines.filter(
      (line) => !CLOSED_PATTERN.test(line) && !/^åter\b/i.test(line),
    );
    return {
      dishes: isClosed ? [] : normalizeDishLines(dishLines),
      availability: isClosed
        ? ('closed' as const)
        : dishLines.length > 0
          ? ('menu' as const)
          : ('not_published' as const),
      temporal: { weekdays: [weekday] },
      sourceUrl: response.finalUrl,
      retrievedAt: response.retrievedAt,
      rawExcerpt: excerpt(lines),
      sourceHash: hashResponse(response),
      ...(isClosed
        ? {
            detail:
              excerpt(lines) ?? 'The official weekday section marks lunch closed.',
          }
        : {}),
    };
  }
}
