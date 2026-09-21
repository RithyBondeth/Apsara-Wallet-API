import { ConfigService } from '@nestjs/config';
import { RecurringSchedulerService } from './recurring-scheduler.service';
import { RecurringService } from './recurring.service';

function build(env: Record<string, string> = {}) {
  const recurring = {
    runDueAllIfLeader: jest.fn().mockResolvedValue({
      posted: 0,
      rulesRun: 0,
      capped: false,
      usersAffected: 0,
      skipped: false,
    }),
  };
  const config = { get: (key: string) => env[key] };
  const scheduler = new RecurringSchedulerService(
    recurring as unknown as RecurringService,
    config as unknown as ConfigService,
  );
  return { scheduler, recurring };
}

describe('RecurringSchedulerService.handleCron', () => {
  it('runs the leader-gated materialisation by default', async () => {
    const { scheduler, recurring } = build();
    await scheduler.handleCron();
    expect(recurring.runDueAllIfLeader).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when RECURRING_SCHEDULER_ENABLED=false', async () => {
    const { scheduler, recurring } = build({
      RECURRING_SCHEDULER_ENABLED: 'false',
    });
    await scheduler.handleCron();
    expect(recurring.runDueAllIfLeader).not.toHaveBeenCalled();
  });

  it('skips a tick while the previous run is still going', async () => {
    const { scheduler, recurring } = build();
    let finish!: () => void;
    recurring.runDueAllIfLeader.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );

    const first = scheduler.handleCron();
    await scheduler.handleCron(); // overlaps → skipped
    expect(recurring.runDueAllIfLeader).toHaveBeenCalledTimes(1);

    finish();
    await first;
    await scheduler.handleCron(); // runs again once the first has finished
    expect(recurring.runDueAllIfLeader).toHaveBeenCalledTimes(2);
  });

  it('swallows a failed run so the cron keeps firing', async () => {
    const { scheduler, recurring } = build();
    recurring.runDueAllIfLeader.mockRejectedValueOnce(new Error('db down'));

    await expect(scheduler.handleCron()).resolves.toBeUndefined();
    await scheduler.handleCron();
    expect(recurring.runDueAllIfLeader).toHaveBeenCalledTimes(2);
  });
});
