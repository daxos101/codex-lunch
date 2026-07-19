import { AddfoodWeeklyHtmlAdapter } from './adapters/addfood.js';
import { LandetDailyHtmlAdapter } from './adapters/landet.js';
import { ManualReviewAdapter } from './adapters/manual-review.js';
import { CollectionError } from './errors.js';
import type { MenuAdapter } from './types.js';

export class AdapterRegistry {
  private readonly adapters = new Map<string, MenuAdapter>();

  constructor(adapters: MenuAdapter[] = []) {
    for (const adapter of adapters) this.register(adapter);
  }

  register(adapter: MenuAdapter): void {
    if (this.adapters.has(adapter.id)) {
      throw new CollectionError('configuration', `Duplicate adapter id: ${adapter.id}`);
    }
    this.adapters.set(adapter.id, adapter);
  }

  get(id: string): MenuAdapter {
    const adapter = this.adapters.get(id);
    if (!adapter) {
      throw new CollectionError(
        'adapter_not_found',
        `No adapter is registered for "${id}"`,
      );
    }
    return adapter;
  }

  ids(): string[] {
    return [...this.adapters.keys()].sort();
  }
}

export function createDefaultAdapterRegistry(): AdapterRegistry {
  return new AdapterRegistry([
    new AddfoodWeeklyHtmlAdapter(),
    new LandetDailyHtmlAdapter(),
    new ManualReviewAdapter(),
  ]);
}
