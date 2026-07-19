import { describe, expect, it } from 'vitest';

import { deduplicateDishes, normalizeDish } from './normalization.js';

describe('menu normalization', () => {
  it('normalizes whitespace, bullets, and Swedish dietary markers', () => {
    expect(
      normalizeDish({
        name: '  •  Vegansk   gryta ',
        description: ' med   rostad potatis ',
        priceSek: 135,
      }),
    ).toEqual({
      name: 'Vegansk gryta',
      description: 'med rostad potatis',
      priceSek: 135,
      dietary: ['vegan', 'vegetarian'],
    });
  });

  it('prevents duplicate normalized dishes without conflating different text', () => {
    const first = normalizeDish({ name: 'Dagens fisk', description: 'med potatis' });
    const duplicate = normalizeDish({
      name: 'DAGENS FISK',
      description: 'med  potatis',
    });
    const distinct = normalizeDish({
      name: 'Dagens fisk',
      description: 'med ris',
    });

    expect(deduplicateDishes([first, duplicate, distinct])).toEqual([first, distinct]);
  });
});
