#!/usr/bin/env node
import { ConsoleJsonLogger } from '@lunch/scraping';

import { createRuntimeDependencies } from './runtime.js';
import { runCollection } from './run.js';
import { startMorningScheduler } from './scheduler.js';

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

function usage(): string {
  return [
    'Usage:',
    '  worker collect all [--date YYYY-MM-DD]',
    '  worker collect one <slug> [--date YYYY-MM-DD]',
    '  worker collect --restaurant <slug> [--date YYYY-MM-DD]',
    '  worker schedule',
    '  worker status',
    '  worker failures [--limit N]',
    '  worker summary',
  ].join('\n');
}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  if (!command || command === '--help' || command === 'help') {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const dependencies = await createRuntimeDependencies();
  const logger = new ConsoleJsonLogger();
  let scheduled = false;
  try {
    if (command === 'collect') {
      const mode = args[1];
      const restaurantSlug =
        option(args, '--restaurant') ?? (mode === 'one' ? args[2] : undefined);
      if (mode !== 'all' && mode !== 'one' && !option(args, '--restaurant')) {
        throw new Error(`Invalid collection mode.\n${usage()}`);
      }
      if (mode === 'one' && !restaurantSlug) {
        throw new Error('collect one requires a restaurant slug');
      }
      const summary = await runCollection({
        repository: dependencies.repository,
        lock: dependencies.lock,
        logger,
        ...(restaurantSlug ? { restaurantSlug } : {}),
        ...(option(args, '--date') ? { targetDate: option(args, '--date') } : {}),
      });
      printJson(summary);
      if (summary.status === 'failed' || summary.status === 'partial_failure') {
        process.exitCode = 1;
      }
    } else if (command === 'schedule') {
      scheduled = true;
      const task = startMorningScheduler({
        repository: dependencies.repository,
        lock: dependencies.lock,
        logger,
      });
      const stop = async (): Promise<void> => {
        task.stop();
        await dependencies.close();
        process.exit(0);
      };
      process.once('SIGTERM', () => void stop());
      process.once('SIGINT', () => void stop());
    } else if (command === 'status') {
      printJson(await dependencies.repository.latestStatuses());
    } else if (command === 'failures') {
      const parsedLimit = Number(option(args, '--limit') ?? '25');
      if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 200) {
        throw new Error('--limit must be an integer from 1 to 200');
      }
      printJson(await dependencies.repository.recentFailures(parsedLimit));
    } else if (command === 'summary') {
      printJson(await dependencies.repository.latestRunSummary());
    } else {
      throw new Error(`Unknown command: ${command}\n${usage()}`);
    }
  } finally {
    if (!scheduled) await dependencies.close();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'Unknown worker error'}\n`,
  );
  process.exitCode = 1;
});
