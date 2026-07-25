import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export const DRIZZLE = Symbol('DRIZZLE');

/** Typed handle injected everywhere: @Inject(DRIZZLE) db: DrizzleDB */
export type DrizzleDB = NodePgDatabase<typeof schema>;

/** The transaction handle passed to db.transaction(async (tx) => ...). */
export type DrizzleTx = Parameters<
  Parameters<DrizzleDB['transaction']>[0]
>[0];

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: DRIZZLE,
      inject: [ConfigService],
      useFactory: (config: ConfigService): DrizzleDB => {
        const pool = new Pool({
          connectionString: config.getOrThrow<string>('DATABASE_URL'),
        });
        return drizzle(pool, { schema, casing: 'snake_case' });
      },
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule {}
