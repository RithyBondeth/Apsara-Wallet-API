import {
  pgTable,
  uuid,
  text,
  bigint,
  doublePrecision,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';
import { users } from './users.schema';
import { walletKindEnum } from './enums';

export const wallets = pgTable('wallets', {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid()
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  kind: walletKindEnum().notNull().default('bank'),
  balanceKhr: bigint({ mode: 'number' }).notNull().default(0),
  balanceUsd: doublePrecision().notNull().default(0),
  brandColor: text(), // hex token, e.g. "#1E88E5"
  accountLast4: text(),
  shortCode: text(),
  icon: text(), // icon token resolved client-side
  isPrimary: boolean().notNull().default(false),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export type Wallet = typeof wallets.$inferSelect;
export type NewWallet = typeof wallets.$inferInsert;
