import { pgEnum } from 'drizzle-orm/pg-core';

export const categoryTypeEnum = pgEnum('category_type', ['income', 'expense']);
