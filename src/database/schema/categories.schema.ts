import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './users.schema';
import { categoryTypeEnum } from '../enums/category-type.enum';

/**
 * System categories (is_system = true) have a null userId and are shared by
 * everyone — they mirror the static catalog in the Flutter app. Users may also
 * create their own categories, which carry their userId.
 */
export const categories = pgTable(
  'categories',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid().references(() => users.id, { onDelete: 'cascade' }),
    slug: text().notNull(), // e.g. "food", "salary" — stable client key
    name: text().notNull(),
    type: categoryTypeEnum().notNull(),
    icon: text(), // icon token resolved client-side
    color: text(), // hex token
    isSystem: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Each system category slug is unique per type; user categories are exempt.
    uniqueIndex('categories_system_slug_type_idx')
      .on(t.slug, t.type)
      .where(sql`${t.userId} is null`),
  ],
);

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
