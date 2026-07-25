import { pgTable, uuid, text, bigint, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.schema';

/** Tracking only — goals never move money. */
export const savingsGoals = pgTable('savings_goals', {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid()
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  icon: text(),
  color: text(),
  savedKhr: bigint({ mode: 'number' }).notNull().default(0),
  targetKhr: bigint({ mode: 'number' }).notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export type SavingsGoal = typeof savingsGoals.$inferSelect;
export type NewSavingsGoal = typeof savingsGoals.$inferInsert;
