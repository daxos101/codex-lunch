import type { MenuAdapter } from '../types.js';

export class ManualReviewAdapter implements MenuAdapter {
  readonly id = 'manual-review';

  async extract(input: Parameters<MenuAdapter['extract']>[0]) {
    return {
      dishes: [],
      availability: 'unknown' as const,
      temporal: {},
      sourceUrl: input.restaurant.menuSourceUrl,
      retrievedAt: new Date().toISOString(),
      detail:
        'This official menu source requires manual review; no automated menu was collected.',
    };
  }
}
