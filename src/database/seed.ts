import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { categories } from './schema';

/**
 * System categories mirror the static catalog in the Flutter app
 * (transaction_categories.dart). They have a null userId and is_system = true,
 * so every user sees them. Re-running is safe (idempotent on slug+type).
 */
const SYSTEM_CATEGORIES = [
  // Expense
  { slug: 'food', name: 'Food & Drink', type: 'expense', icon: 'food', color: '#F4511E' },
  { slug: 'transport', name: 'Transport', type: 'expense', icon: 'transport', color: '#3949AB' },
  { slug: 'shopping', name: 'Shopping', type: 'expense', icon: 'shopping', color: '#8E24AA' },
  { slug: 'bills', name: 'Bills', type: 'expense', icon: 'bills', color: '#00897B' },
  { slug: 'health', name: 'Health', type: 'expense', icon: 'health', color: '#E53935' },
  { slug: 'education', name: 'Education', type: 'expense', icon: 'education', color: '#1E88E5' },
  { slug: 'entertainment', name: 'Entertainment', type: 'expense', icon: 'entertainment', color: '#D81B60' },
  { slug: 'travel', name: 'Travel', type: 'expense', icon: 'travel', color: '#00ACC1' },
  { slug: 'personalCare', name: 'Personal Care', type: 'expense', icon: 'personalCare', color: '#F06292' },
  { slug: 'gifts', name: 'Gifts', type: 'expense', icon: 'gifts', color: '#C0CA33' },
  { slug: 'othersExpense', name: 'Others', type: 'expense', icon: 'others', color: '#757575' },
  // Income
  { slug: 'salary', name: 'Salary', type: 'income', icon: 'salary', color: '#43A047' },
  { slug: 'business', name: 'Business', type: 'income', icon: 'business', color: '#FB8C00' },
  { slug: 'investment', name: 'Investment', type: 'income', icon: 'investment', color: '#5E35B1' },
  { slug: 'giftsIncome', name: 'Gifts', type: 'income', icon: 'gifts', color: '#7CB342' },
  { slug: 'othersIncome', name: 'Others', type: 'income', icon: 'others', color: '#757575' },
] as const;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema, casing: 'snake_case' });

  for (const c of SYSTEM_CATEGORIES) {
    await db
      .insert(categories)
      .values({ ...c, isSystem: true, userId: null })
      .onConflictDoNothing();
  }

  console.log(`Seeded ${SYSTEM_CATEGORIES.length} system categories.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
