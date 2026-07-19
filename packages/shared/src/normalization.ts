import { createHash } from 'node:crypto';

import { dishSchema, type Dish } from './contracts.js';

const DIETARY_MARKERS: Array<[RegExp, Dish['dietary'][number]]> = [
  [/\bvegansk(?:t|a)?\b|\bvegan\b/i, 'vegan'],
  [/\bvegetarisk(?:t|a)?\b|\bvegetarian\b/i, 'vegetarian'],
  [/\bglutenfri(?:tt|a)?\b/i, 'gluten_free'],
  [/\blaktosfri(?:tt|a)?\b/i, 'lactose_free'],
];

function normalizedWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function normalizeDish(input: {
  name: string;
  description?: string;
  priceSek?: number;
  dietary?: Dish['dietary'];
}): Dish {
  const name = normalizedWhitespace(input.name.trim().replace(/^[•*\-–—]\s*/, ''));
  const description = input.description
    ? normalizedWhitespace(input.description)
    : undefined;
  const haystack = `${name} ${description ?? ''}`;
  const detected = DIETARY_MARKERS.filter(([pattern]) => pattern.test(haystack)).map(
    ([, tag]) => tag,
  );
  if (detected.includes('vegan') && !detected.includes('vegetarian')) {
    detected.push('vegetarian');
  }
  const dietary = [...new Set([...(input.dietary ?? []), ...detected])];

  return dishSchema.parse({
    name,
    ...(description ? { description } : {}),
    ...(input.priceSek === undefined ? {} : { priceSek: input.priceSek }),
    dietary,
  });
}

export function deduplicateDishes(dishes: Dish[]): Dish[] {
  const seen = new Set<string>();
  return dishes.filter((dish) => {
    const key = `${dish.name}|${dish.description ?? ''}`
      .toLocaleLowerCase('sv-SE')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function sourceContentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}
