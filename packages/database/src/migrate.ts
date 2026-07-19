import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { createPool } from './client.js';

export async function migrate(): Promise<void> {
  const pool = createPool({ applicationName: 'hagersten-lunch-migrate' });
  const migrationsDirectory = fileURLToPath(new URL('../migrations/', import.meta.url));
  try {
    const filenames = (await readdir(migrationsDirectory))
      .filter((filename) => filename.endsWith('.sql'))
      .sort();
    await pool.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         filename text PRIMARY KEY,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`,
    );
    for (const filename of filenames) {
      const exists = await pool.query(
        'SELECT 1 FROM schema_migrations WHERE filename = $1',
        [filename],
      );
      if (exists.rowCount) continue;
      const sql = await readFile(`${migrationsDirectory}/${filename}`, 'utf8');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
          [filename],
        );
        await client.query('COMMIT');
        process.stdout.write(
          `${JSON.stringify({ level: 'info', event: 'migration_applied', filename })}\n`,
        );
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
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
}
