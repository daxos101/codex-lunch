import { migrate } from '@lunch/database';

migrate().catch((error: unknown) => {
  process.stderr.write(
    `${JSON.stringify({
      level: 'error',
      event: 'migration_failed',
      error: error instanceof Error ? error.message : String(error),
    })}\n`,
  );
  process.exitCode = 1;
});
