import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.schema';

export const notifications = pgTable(
  'notifications',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Event kind (e.g. 'recurring_posted') so bilingual clients can localize the
    // copy themselves; title/body hold a server-rendered fallback.
    type: text(),
    // Params for client-side localization (counts, names, percentages).
    data: jsonb().$type<Record<string, unknown>>(),
    title: text().notNull(),
    body: text().notNull(),
    icon: text(),
    color: text(),
    read: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('notifications_user_created_idx').on(t.userId, t.createdAt),
    // One monthly insight per user per period. The service's check-then-insert
    // is not atomic on its own: two concurrent posts (the app re-posts on every
    // ledger change) both saw "no row yet" and both inserted.
    uniqueIndex('notifications_insight_period_uidx')
      .on(t.userId, sql`(${t.data} ->> 'periodKey')`)
      .where(sql`${t.type} = 'insight'`),
  ],
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
