import { pgTable, uuid, text, bigint, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.schema';
import { wallets } from './wallets.schema';
import { categories } from './categories.schema';
import { transactionTypeEnum } from './enums';

export const transactions = pgTable('transactions', {
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
  note: text(),
  date: timestamp({ withTimezone: true }).notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
