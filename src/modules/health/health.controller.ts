import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../database/database.module';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /**
   * Liveness + readiness probe for the platform (see railway.json). Touches
   * the database so a deploy with a broken connection string fails the health
   * check instead of going live and 500-ing every request.
   */
  @Get()
  @ApiOperation({ summary: 'Service and database health' })
  async check() {
    try {
      await this.db.execute(sql`select 1`);
    } catch {
      throw new ServiceUnavailableException('Database unreachable');
    }
    return { status: 'ok', uptime: Math.round(process.uptime()) };
  }
}
