import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../schema';

export const DRIZZLE = Symbol('DRIZZLE');

/** Typed handle injected everywhere: @Inject(DRIZZLE) db: DrizzleDB */
export type DrizzleDB = NodePgDatabase<typeof schema>;

/** The transaction handle passed to db.transaction(async (tx) => ...). */
export type DrizzleTx = Parameters<Parameters<DrizzleDB['transaction']>[0]>[0];
