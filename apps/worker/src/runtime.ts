import type { WorkerDependencies } from './contracts.js';

export async function createRuntimeDependencies(): Promise<WorkerDependencies> {
  const database = await import('@lunch/database');
  return database.createWorkerDependencies();
}
