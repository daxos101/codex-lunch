import type { Dish, Restaurant } from '@lunch/shared';

import type { FetchTextClient } from './http.js';
import type { StructuredLogger } from './logger.js';

export type AvailabilityEvidence = 'menu' | 'closed' | 'not_published' | 'unknown';

export interface TemporalEvidence {
  dates?: string[];
  weekdays?: string[];
  isoWeek?: number;
  isoWeekYear?: number;
  conflicting?: boolean;
}

export interface AdapterExtraction {
  dishes: Dish[];
  availability: AvailabilityEvidence;
  temporal: TemporalEvidence;
  sourceUrl: string;
  retrievedAt: string;
  rawExcerpt?: string;
  sourceHash?: string;
  detail?: string;
}

export interface AdapterInput {
  restaurant: Restaurant;
  targetDate: string;
  http: FetchTextClient;
  logger: StructuredLogger;
}

export interface MenuAdapter {
  readonly id: string;
  extract(input: AdapterInput): Promise<AdapterExtraction>;
}
