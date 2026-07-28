import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';
import { users } from './users.schema';

export const notifications = pgTable('notifications', {
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
});

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
