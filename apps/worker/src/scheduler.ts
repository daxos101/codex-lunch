import cron, { type ScheduledTask } from 'node-cron';

import type { StructuredLogger } from '@lunch/scraping';
import { STOCKHOLM_TIME_ZONE } from '@lunch/shared';

import type { RunLock, WorkerRepository } from './contracts.js';
import { runCollection } from './run.js';

export const MORNING_COLLECTION_CRON = '15 8 * * *';

export interface SchedulerOptions {
  repository: WorkerRepository;
  lock: RunLock;
  logger: StructuredLogger;
}

export function startMorningScheduler(options: SchedulerOptions): ScheduledTask {
  const task = cron.schedule(
    MORNING_COLLECTION_CRON,
    async () => {
      try {
        await runCollection(options);
      } catch (error) {
        options.logger.log('error', {
          event: 'scheduled_collection_run_failed',
          message: error instanceof Error ? error.message : 'Unknown scheduler failure',
        });
      }
    },
    {
      timezone: STOCKHOLM_TIME_ZONE,
      name: 'hagersten-lunch-morning-collection',
      noOverlap: true,
    },
  );
  options.logger.log('info', {
    event: 'collection_scheduler_started',
    cron: MORNING_COLLECTION_CRON,
    timeZone: STOCKHOLM_TIME_ZONE,
  });
  return task;
}
