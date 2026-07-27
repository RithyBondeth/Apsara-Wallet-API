import { pgTable, uuid, text, bigint, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.schema';
import { wallets } from './wallets.schema';
import { categories } from './categories.schema';
import { transactionTypeEnum, recurrenceFrequencyEnum } from '../enums/enums';

export const recurringRules = pgTable('recurring_rules', {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid()
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  walletId: uuid()
    .notNull()
    .references(() => wallets.id, { onDelete: 'restrict' }),
  categoryId: uuid()
    .notNull()
    .references(() => categories.id, { onDelete: 'restrict' }),
  title: text().notNull(),
  amountKhr: bigint({ mode: 'number' }).notNull(),
  type: transactionTypeEnum().notNull(),
  frequency: recurrenceFrequencyEnum().notNull(),
  nextDue: timestamp({ withTimezone: true }).notNull(),
  note: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export type RecurringRule = typeof recurringRules.$inferSelect;
export type NewRecurringRule = typeof recurringRules.$inferInsert;
