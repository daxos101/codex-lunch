import {
  collectionResultSchema,
  deduplicateDishes,
  stockholmDate,
  stockholmWeekday,
  weekdayMatchesDate,
  type CollectionResult,
} from '@lunch/shared';

import type { AdapterExtraction, TemporalEvidence } from './types.js';

function isoWeekParts(date: string): { week: number; year: number } {
  const value = new Date(`${date}T12:00:00Z`);
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - day);
  const year = value.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  return {
    year,
    week: Math.ceil(((value.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7),
  };
}

type EvidenceAssessment = 'current' | 'mismatch' | 'insufficient' | 'conflict';

function assessEvidence(
  evidence: TemporalEvidence,
  targetDate: string,
  retrievedAt: string,
): EvidenceAssessment {
  if (evidence.conflicting) return 'conflict';

  const dates = [...new Set(evidence.dates ?? [])];
  if (dates.length > 1) {
    return dates.includes(targetDate) ? 'conflict' : 'mismatch';
  }
  if (dates.length === 1) {
    return dates[0] === targetDate ? 'current' : 'mismatch';
  }

  const weekdays = [...new Set(evidence.weekdays ?? [])];
  const weekdayResults = weekdays.map((weekday) =>
    weekdayMatchesDate(weekday, targetDate),
  );
  if (weekdayResults.some(Boolean) && weekdayResults.some((match) => !match)) {
    return 'conflict';
  }
  if (weekdays.length > 0 && !weekdayResults.some(Boolean)) return 'mismatch';

  const targetWeek = isoWeekParts(targetDate);
  if (evidence.isoWeek !== undefined && evidence.isoWeek !== targetWeek.week) {
    return 'mismatch';
  }
  if (evidence.isoWeekYear !== undefined && evidence.isoWeekYear !== targetWeek.year) {
    return 'mismatch';
  }

  if (weekdays.length > 0) {
    const retrievalDate = stockholmDate(new Date(retrievedAt));
    if (retrievalDate === targetDate) return 'current';

    const retrievalWeek = isoWeekParts(retrievalDate);
    const sameObservedWeek =
      evidence.isoWeek !== undefined &&
      evidence.isoWeek === targetWeek.week &&
      retrievalWeek.year === targetWeek.year;
    return sameObservedWeek ? 'current' : 'insufficient';
  }

  if (
    evidence.isoWeek !== undefined &&
    evidence.isoWeek === targetWeek.week &&
    stockholmWeekday(targetDate) >= 1 &&
    stockholmWeekday(targetDate) <= 5
  ) {
    return 'insufficient';
  }
  return 'insufficient';
}

export function classifyExtraction(
  extraction: AdapterExtraction,
  targetDate: string,
): CollectionResult {
  const dishes = deduplicateDishes(extraction.dishes);
  const assessment = assessEvidence(
    extraction.temporal,
    targetDate,
    extraction.retrievedAt,
  );

  let status: CollectionResult['status'];
  let statusDetail = extraction.detail;
  if (assessment === 'conflict') {
    status = 'manual_review';
    statusDetail ??= 'The source contains conflicting date evidence.';
  } else if (assessment === 'mismatch') {
    status = 'possibly_stale';
    statusDetail ??= 'The source evidence does not match the requested date.';
  } else if (assessment === 'insufficient') {
    status = dishes.length > 0 ? 'possibly_stale' : 'manual_review';
    statusDetail ??=
      dishes.length > 0
        ? 'Dishes were found without enough evidence to confirm the requested date.'
        : 'The source did not provide enough date evidence for automatic classification.';
  } else if (extraction.availability === 'closed') {
    status = 'closed';
    statusDetail ??= 'The official source marks lunch as closed.';
  } else if (extraction.availability === 'not_published' || dishes.length === 0) {
    status = 'not_published';
    statusDetail ??= 'The current section exists but contains no published dishes.';
  } else if (extraction.availability === 'menu' && dishes.length > 0) {
    status = 'confirmed_today';
  } else {
    status = 'manual_review';
    statusDetail ??= 'The source state could not be classified safely.';
  }

  return collectionResultSchema.parse({
    status,
    ...(statusDetail ? { statusDetail: statusDetail.slice(0, 500) } : {}),
    menuDate: assessment === 'current' ? targetDate : null,
    dishes: status === 'confirmed_today' ? dishes : [],
    sourceUrl: extraction.sourceUrl,
    retrievedAt: extraction.retrievedAt,
    ...(extraction.rawExcerpt
      ? { rawExcerpt: extraction.rawExcerpt.slice(0, 20_000) }
      : {}),
    ...(extraction.sourceHash ? { sourceHash: extraction.sourceHash } : {}),
  });
}

export function getIsoWeek(date: string): number {
  return isoWeekParts(date).week;
}
