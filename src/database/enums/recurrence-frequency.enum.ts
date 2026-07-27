import { pgEnum } from 'drizzle-orm/pg-core';

export const recurrenceFrequencyEnum = pgEnum('recurrence_frequency', [
  'weekly',
  'monthly',
]);
