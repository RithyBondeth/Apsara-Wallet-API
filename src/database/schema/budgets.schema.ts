import {
  pgTable,
  uuid,
  varchar,
  bigint,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { users } from './users.schema';
import { categories } from './categories.schema';

/**
 * One row per (user, month, category). `month` is a "YYYY-MM" label to match
 * the app's monthly budgeting. Spent amounts are NOT stored — they are computed
 * from the ledger at read time.
 */
export const budgets = pgTable(
  'budgets',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    categoryId: uuid()
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    month: varchar({ length: 7 }).notNull(), // "YYYY-MM"
    limitKhr: bigint({ mode: 'number' }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.userId, t.month, t.categoryId)],
);

export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
