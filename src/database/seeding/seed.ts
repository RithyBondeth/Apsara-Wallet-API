import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../schema';
import { categories } from '../schema';
import { SYSTEM_CATEGORIES_DATA } from './system-categoty.data';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema, casing: 'snake_case' });

  for (const c of SYSTEM_CATEGORIES_DATA) {
    await db
      .insert(categories)
      .values({ ...c, isSystem: true, userId: null })
      .onConflictDoNothing();
  }

  console.log(`Seeded ${SYSTEM_CATEGORIES_DATA.length} system categories.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
