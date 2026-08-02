import { Pool, type PoolConfig } from 'pg';

/**
 * Builds the Postgres pool config shared by the Nest provider and the
 * standalone migrator, so both agree on TLS.
 *
 * Managed providers (Railway, Fly, Neon, …) terminate TLS with certificates
 * that don't chain to a public root, so verification is disabled while the
 * connection itself stays encrypted. Railway's *private* network URL needs no
 * TLS at all — leave `DATABASE_SSL` unset there.
 */
export function poolConfig(databaseUrl: string): PoolConfig {
  const sslEnabled =
    process.env.DATABASE_SSL === 'true' ||
    /[?&]sslmode=(require|verify-ca|verify-full)/.test(databaseUrl);

  return {
    connectionString: databaseUrl,
    ...(sslEnabled ? { ssl: { rejectUnauthorized: false } } : {}),
  };
}

export function createPool(databaseUrl: string): Pool {
  return new Pool(poolConfig(databaseUrl));
}
