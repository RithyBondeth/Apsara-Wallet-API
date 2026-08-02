import { pgEnum } from 'drizzle-orm/pg-core';

export const walletKindEnum = pgEnum('wallet_kind', [
  'bank',
  'cash',
  'ewallet',
]);
