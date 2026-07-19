import { createPool, type DatabaseOptions } from './client.js';
import { migrate } from './migrate.js';
import { LunchRepository, PostgresRunLock } from './repository.js';
import { seed } from './seed.js';

export { createPool, LunchRepository, migrate, PostgresRunLock, seed };
export type { DatabaseOptions } from './client.js';
export type {
  FinishCollectionRunInput,
  SaveCollectionAttemptInput,
  StartCollectionRunInput,
} from './repository.js';

export function createWorkerDependencies(options: DatabaseOptions = {}) {
  const pool = createPool({
    ...options,
    applicationName: options.applicationName ?? 'hagersten-lunch-worker',
  });
  return {
    repository: new LunchRepository(pool),
    lock: new PostgresRunLock(pool),
    close: () => pool.end(),
  };
}
