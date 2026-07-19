import type { CollectionResult, MenuStatus, Restaurant } from '@lunch/shared';

export interface SaveCollectionAttemptInput {
  restaurant: Restaurant;
  targetDate: string;
  startedAt: string;
  finishedAt: string;
  result: CollectionResult;
  errorCategory?: string;
  runId?: string;
}

export interface RestaurantStatusRecord {
  slug: string;
  name: string;
  status: MenuStatus;
  lastAttempt: string | null;
  lastSuccess: string | null;
}

export interface FailureRecord {
  slug: string;
  targetDate: string;
  finishedAt: string;
  status: MenuStatus;
  errorCategory: string | null;
  detail: string | null;
}

export interface StoredRunSummary {
  id: string;
  targetDate: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  attemptedCount: number;
  successfulCount: number;
  failedCount: number;
  summary: unknown;
}

export interface StartCollectionRunInput {
  targetDate: string;
  requestedRestaurantSlug?: string;
  startedAt: string;
}

export interface FinishCollectionRunInput {
  runId: string;
  finishedAt: string;
  status: 'completed' | 'partial_failure' | 'failed';
  attemptedCount: number;
  successfulCount: number;
  failedCount: number;
  summary: unknown;
}

export interface WorkerRepository {
  listEnabledRestaurants(): Promise<Restaurant[]>;
  findRestaurantBySlug(slug: string): Promise<Restaurant | undefined>;
  saveCollectionAttempt(input: SaveCollectionAttemptInput): Promise<void>;
  latestStatuses(): Promise<RestaurantStatusRecord[]>;
  recentFailures(limit?: number): Promise<FailureRecord[]>;
  latestRunSummary(): Promise<StoredRunSummary | null>;
  startCollectionRun?(input: StartCollectionRunInput): Promise<string>;
  finishCollectionRun?(input: FinishCollectionRunInput): Promise<void>;
}

export interface AcquiredRunLock {
  release(): Promise<void>;
}

export interface RunLock {
  tryAcquire(name: string): Promise<AcquiredRunLock | null>;
}

export interface WorkerDependencies {
  repository: WorkerRepository;
  lock: RunLock;
  close(): Promise<void>;
}
