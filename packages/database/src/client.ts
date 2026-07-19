import pg from 'pg';

const { Pool } = pg;

export interface DatabaseOptions {
  connectionString?: string;
  maxConnections?: number;
  applicationName?: string;
}

export function createPool(options: DatabaseOptions = {}): pg.Pool {
  const connectionString = options.connectionString ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  return new Pool({
    connectionString,
    max: options.maxConnections ?? 10,
    application_name: options.applicationName ?? 'hagersten-lunch',
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    ...(process.env.DATABASE_SSL === 'require'
      ? { ssl: { rejectUnauthorized: true } }
      : {}),
  });
}
