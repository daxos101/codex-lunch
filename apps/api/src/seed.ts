import { seed } from '@lunch/database';

seed().catch((error: unknown) => {
  process.stderr.write(
    `${JSON.stringify({
      level: 'error',
      event: 'seed_failed',
      error: error instanceof Error ? error.message : String(error),
    })}\n`,
  );
  process.exitCode = 1;
});
