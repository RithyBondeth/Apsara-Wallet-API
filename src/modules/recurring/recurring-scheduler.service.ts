import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RecurringService } from './recurring.service';

/**
 * Posts due recurring occurrences for every user on a schedule, so entries
 * materialize even for accounts that never open the app (the mobile client
 * also triggers `POST /recurring/run` on launch — both paths are idempotent,
 * so running both is safe).
 *
 * Disable with `RECURRING_SCHEDULER_ENABLED=false` (e.g. to avoid duplicate
 * runs when scaling to multiple instances — cross-instance locking is out of
 * scope here; run the cron on a single instance).
 */
@Injectable()
export class RecurringSchedulerService {
  private readonly logger = new Logger(RecurringSchedulerService.name);
  private running = false;

  constructor(
    private readonly recurring: RecurringService,
    private readonly config: ConfigService,
  ) {}

  private get enabled(): boolean {
    return this.config.get<string>('RECURRING_SCHEDULER_ENABLED') !== 'false';
  }

  @Cron(CronExpression.EVERY_HOUR, { name: 'recurring-run' })
  async handleCron(): Promise<void> {
    if (!this.enabled) return;
    // Skip if the previous run is still going (a long catch-up shouldn't
    // overlap the next tick and double-process).
    if (this.running) {
      this.logger.warn('Previous recurring run still in progress; skipping.');
      return;
    }
    this.running = true;
    try {
      // Leader-gated: only the instance that wins the advisory lock runs.
      const result = await this.recurring.runDueAllIfLeader();
      if (result.skipped) {
        this.logger.debug('Another instance holds the run lock; skipping.');
      } else if (result.posted > 0) {
        this.logger.log(
          `Posted ${result.posted} occurrence(s) across ` +
            `${result.rulesRun} rule(s) for ${result.usersAffected} user(s)` +
            (result.capped ? ' (some rules hit the catch-up cap)' : ''),
        );
      }
    } catch (err) {
      this.logger.error('Recurring scheduler run failed', err as Error);
    } finally {
      this.running = false;
    }
  }
}
