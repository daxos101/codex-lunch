import { createPool, LunchRepository } from '@lunch/database';

import { buildApp } from './app.js';
import { readConfig } from './config.js';

async function start(): Promise<void> {
  const config = readConfig();
  const pool = createPool({
    connectionString: config.databaseUrl,
    applicationName: 'hagersten-lunch-api',
  });
  const repository = new LunchRepository(pool);
  const app = await buildApp({
    repository,
    allowedOrigins: config.allowedOrigins,
  });

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'shutdown_started');
    await app.close();
    await pool.end();
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  try {
    await app.listen({ host: config.host, port: config.port });
  } catch (error) {
    app.log.error({ err: error }, 'api_start_failed');
    await pool.end();
    process.exitCode = 1;
  }
}

void start();
