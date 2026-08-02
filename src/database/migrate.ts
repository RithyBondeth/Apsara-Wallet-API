import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createPool } from './pool';

/**
 * Arbitrary but fixed key identifying "the Apsara Wallet schema migration".
 * Any process holding it is migrating; everyone else waits.
 */
const MIGRATION_LOCK_KEY = 4919201984;

/**
 * Applies pending SQL migrations from ./drizzle, then exits.
 *
 * Runs as its own process before the server boots (see the Dockerfile CMD) so
 * a failed migration stops the deploy instead of leaving a half-migrated app
 * serving traffic. Uses drizzle-orm's runtime migrator rather than drizzle-kit
 * so the production image doesn't need dev dependencies.
 *
 * Drizzle's migrator does NOT take a lock of its own: it reads the latest
 * applied migration, then replays everything newer. Two instances booting
 * together would both read the same starting point and both replay the same
 * DDL, and the loser would crash on "relation already exists". The advisory
 * lock below serialises that, so scaling past one instance is safe.
 */
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set — cannot run migrations.');
  }

  const pool = createPool(databaseUrl);
  // A dedicated session: advisory locks are held per connection, so the lock
  // must not be handed back to the pool while migrations run.
  const lockHolder = await pool.connect();
  try {
    await lockHolder.query('SELECT pg_advisory_lock($1)', [
      MIGRATION_LOCK_KEY,
    ]);
    await migrate(drizzle(pool), { migrationsFolder: './drizzle' });
    console.log('Migrations applied.');
  } finally {
    await lockHolder
      .query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY])
      .catch(() => {
        // Losing the unlock is harmless — the lock dies with the session.
      });
    lockHolder.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
