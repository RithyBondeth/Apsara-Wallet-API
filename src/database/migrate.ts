import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createPool } from './pool';

/**
 * Applies pending SQL migrations from ./drizzle, then exits.
 *
 * Runs as its own process before the server boots (see the Dockerfile CMD) so
 * a failed migration stops the deploy instead of leaving a half-migrated app
 * serving traffic. Uses drizzle-orm's runtime migrator rather than drizzle-kit
 * so the production image doesn't need dev dependencies.
 */
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set — cannot run migrations.');
  }

  const pool = createPool(databaseUrl);
  try {
    await migrate(drizzle(pool), { migrationsFolder: './drizzle' });
    console.log('Migrations applied.');
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
