import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { DRIZZLE, DrizzleDB, DrizzleTx } from './types/drizzle.type';

export { DRIZZLE };
export type { DrizzleDB, DrizzleTx };

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
