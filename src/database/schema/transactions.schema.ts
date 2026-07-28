import {
  pgTable,
  uuid,
  text,
  bigint,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users.schema';
import { wallets } from './wallets.schema';
import { categories } from './categories.schema';
import { transactionTypeEnum } from '../enums/transaction-type.enum';

export const transactions = pgTable(
  'transactions',
  {
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
  },
  (t) => [
    // Main list is WHERE user_id ORDER BY date DESC; also covers the
    // dashboard/analytics/budget date-range scans per user.
    index('transactions_user_date_idx').on(t.userId, t.date),
    // Wallet-detail activity + the wallet-delete "has transactions?" guard.
    index('transactions_wallet_idx').on(t.walletId),
  ],
);

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
