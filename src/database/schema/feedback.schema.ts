import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users.schema';

/**
 * In-app "Rate Apsara Wallet" submissions. Every rating is recorded; a comment
 * is captured for low ratings (the rating gate keeps unhappy feedback in-app
 * instead of pushing it to a public store review).
 */
export const feedback = pgTable(
  'feedback',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    rating: integer().notNull(), // 1..5
    comment: text(),
    appVersion: text(),
    platform: text(), // 'ios' | 'android' | ...
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('feedback_user_idx').on(t.userId)],
);

export type Feedback = typeof feedback.$inferSelect;
export type NewFeedback = typeof feedback.$inferInsert;
