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

/**
 * A movement of money between two of the user's own wallets. Net-zero to total
 * balance, so it is kept OUT of the income/expense ledger (`transactions`) and
 * never counts toward spend/income analytics. Wallet FKs cascade: deleting a
 * wallet drops its transfer records (the balances were already applied).
 */
export const transfers = pgTable(
  'transfers',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    fromWalletId: uuid()
      .notNull()
      .references(() => wallets.id, { onDelete: 'cascade' }),
    toWalletId: uuid()
      .notNull()
      .references(() => wallets.id, { onDelete: 'cascade' }),
    amountKhr: bigint({ mode: 'number' }).notNull(),
    note: text(),
    date: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('transfers_user_idx').on(t.userId)],
);

export type Transfer = typeof transfers.$inferSelect;
export type NewTransfer = typeof transfers.$inferInsert;
