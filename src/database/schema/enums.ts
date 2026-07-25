import { pgEnum } from 'drizzle-orm/pg-core';

/** Mirrors the Flutter ETransactionType enum. */
export const transactionTypeEnum = pgEnum('transaction_type', [
  'income',
  'expense',
]);

/** Mirrors the Flutter WalletKind enum. */
export const walletKindEnum = pgEnum('wallet_kind', ['bank', 'cash', 'ewallet']);

/** Mirrors the Flutter ECurrencyType enum. */
export const currencyEnum = pgEnum('currency', ['usd', 'khr']);

/** Category applicability — an income or an expense category. */
export const categoryTypeEnum = pgEnum('category_type', ['income', 'expense']);

/** Mirrors the Flutter ERecurrenceFrequency enum. */
export const recurrenceFrequencyEnum = pgEnum('recurrence_frequency', [
  'weekly',
  'monthly',
]);
