import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  categories,
  recurringRules,
  transactions,
  wallets,
} from '../../database/schema';
import type { RecurringRule } from '../../database/schema';
import {
  FakeDb,
  fakeNotifications,
  render,
} from '../../../test/support/fake-db';
import { NotificationsService } from '../notifications/notifications.service';
import { nextOccurrence, RecurringService } from './recurring.service';

const USER = '11111111-1111-4111-8111-111111111111';
const USER_2 = '22222222-2222-4222-8222-222222222222';
const WALLET = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CAT = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const NOW = new Date('2024-06-15T12:00:00.000Z');

function rule(over: Partial<RecurringRule> = {}): RecurringRule {
  return {
    id: 'rule-1',
    userId: USER,
    walletId: WALLET,
    categoryId: CAT,
    title: 'House Rent',
    amountKhr: 400_000,
    type: 'expense',
    frequency: 'monthly',
    nextDue: new Date('2024-06-05T00:00:00.000Z'),
    note: null,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    ...over,
  };
}

/** The signed riel delta a wallet update applies, from its rendered SQL. */
function deltaOf(update: { set: Record<string, unknown> }): number {
  const { sql, params } = render(update.set.balanceKhr as never);
  const n = Number(params[0]);
  return sql.includes('- $1') ? -n : n;
}

describe('nextOccurrence', () => {
  const at = (iso: string) => new Date(iso);

  it('adds exactly seven days for weekly rules', () => {
    expect(nextOccurrence(at('2024-06-05T09:30:00Z'), 'weekly')).toEqual(
      at('2024-06-12T09:30:00Z'),
    );
  });

  it('keeps the same day next month when it exists', () => {
    expect(nextOccurrence(at('2024-06-05T09:30:00Z'), 'monthly')).toEqual(
      at('2024-07-05T09:30:00Z'),
    );
  });

  it('clamps to the last day of a shorter month instead of drifting', () => {
    expect(nextOccurrence(at('2024-01-31T00:00:00Z'), 'monthly')).toEqual(
      at('2024-02-29T00:00:00Z'), // leap year
    );
    expect(nextOccurrence(at('2023-01-31T00:00:00Z'), 'monthly')).toEqual(
      at('2023-02-28T00:00:00Z'),
    );
    expect(nextOccurrence(at('2024-03-31T00:00:00Z'), 'monthly')).toEqual(
      at('2024-04-30T00:00:00Z'),
    );
  });

  it('rolls over the year in December', () => {
    expect(nextOccurrence(at('2024-12-15T00:00:00Z'), 'monthly')).toEqual(
      at('2025-01-15T00:00:00Z'),
    );
  });

  it('preserves the time of day', () => {
    expect(nextOccurrence(at('2024-05-20T17:45:10Z'), 'monthly')).toEqual(
      at('2024-06-20T17:45:10Z'),
    );
  });
});

describe('RecurringService', () => {
  let fake: FakeDb;
  let notifications: ReturnType<typeof fakeNotifications>;
  let service: RecurringService;

  beforeEach(() => {
    fake = new FakeDb();
    notifications = fakeNotifications();
    service = new RecurringService(
      fake.db,
      notifications as unknown as NotificationsService,
    );
  });

  describe('runDue', () => {
    it('does nothing when no rule is due', async () => {
      fake.onSelect(recurringRules, []);

      await expect(service.runDue(USER, NOW)).resolves.toEqual({
        posted: 0,
        rulesRun: 0,
        capped: false,
      });
      expect(fake.transactions).toBe(0);
      expect(notifications.emit).not.toHaveBeenCalled();
    });

    it('only asks for this user’s rules that are due as of the given instant', async () => {
      fake.onSelect(recurringRules, []);

      await service.runDue(USER, NOW);

      expect(fake.selected(recurringRules)[0].params).toEqual([
        USER,
        NOW.toISOString(),
      ]);
    });

    it('posts one ledger entry for a rule that is due once', async () => {
      fake.onSelect(recurringRules, [rule()]);

      const res = await service.runDue(USER, NOW);

      expect(res).toEqual({ posted: 1, rulesRun: 1, capped: false });
      expect(fake.inserted(transactions)).toEqual([
        {
          userId: USER,
          walletId: WALLET,
          categoryId: CAT,
          title: 'House Rent',
          amountKhr: 400_000,
          type: 'expense',
          note: null,
          date: new Date('2024-06-05T00:00:00.000Z'),
        },
      ]);
      // One net wallet move, scoped to wallet + owner, inside the rule's tx.
      const [walletUpdate] = fake.updated(wallets);
      expect(deltaOf(walletUpdate)).toBe(-400_000);
      expect(walletUpdate.where.params).toEqual([WALLET, USER]);
      expect(walletUpdate.inTransaction).toBe(true);
      // The anchor advances past now.
      const [ruleUpdate] = fake.updated(recurringRules);
      expect(ruleUpdate.set.nextDue).toEqual(new Date('2024-07-05T00:00:00Z'));
      expect(ruleUpdate.where.params).toEqual(['rule-1']);
    });

    it('catches up every missed occurrence and moves the wallet once by the total', async () => {
      // Salary due on the 1st, last posted through March → April, May, June owed.
      fake.onSelect(recurringRules, [
        rule({
          id: 'salary',
          title: 'Salary',
          type: 'income',
          amountKhr: 3_500_000,
          nextDue: new Date('2024-04-01T00:00:00.000Z'),
        }),
      ]);

      const res = await service.runDue(USER, NOW);

      expect(res.posted).toBe(3);
      expect(fake.inserted(transactions).map((t) => t.date)).toEqual([
        new Date('2024-04-01T00:00:00.000Z'),
        new Date('2024-05-01T00:00:00.000Z'),
        new Date('2024-06-01T00:00:00.000Z'),
      ]);
      const walletUpdates = fake.updated(wallets);
      expect(walletUpdates).toHaveLength(1);
      expect(deltaOf(walletUpdates[0])).toBe(3 * 3_500_000);
      expect(fake.updated(recurringRules)[0].set.nextDue).toEqual(
        new Date('2024-07-01T00:00:00.000Z'),
      );
      expect(notifications.emit).toHaveBeenCalledTimes(1);
      expect(notifications.emit).toHaveBeenCalledWith(
        USER,
        expect.objectContaining({
          type: 'recurring_posted',
          data: { count: 3 },
        }),
      );
    });

    it('is idempotent: a rule whose anchor is in the future posts nothing', async () => {
      // The query would not return it; but even if handed such a rule, the
      // loop guard must hold.
      fake.onSelect(recurringRules, [
        rule({ nextDue: new Date('2024-06-16T00:00:00.000Z') }),
      ]);

      const res = await service.runDue(USER, NOW);

      expect(res.posted).toBe(0);
      expect(fake.inserted(transactions)).toHaveLength(0);
      expect(fake.updated(wallets)).toHaveLength(0);
      expect(notifications.emit).not.toHaveBeenCalled();
    });

    it('caps catch-up at 120 occurrences per rule and reports it', async () => {
      // Weekly rule dormant for ~3 years: 150+ occurrences owed.
      fake.onSelect(recurringRules, [
        rule({
          frequency: 'weekly',
          amountKhr: 10_000,
          nextDue: new Date('2021-06-01T00:00:00.000Z'),
        }),
      ]);

      const res = await service.runDue(USER, NOW);

      expect(res).toEqual({ posted: 120, rulesRun: 1, capped: true });
      expect(fake.inserted(transactions)).toHaveLength(120);
      expect(deltaOf(fake.updated(wallets)[0])).toBe(-120 * 10_000);
      // The anchor lands where the cap stopped, still in the past, so the
      // next run picks up the remainder.
      const nextDue = fake.updated(recurringRules)[0].set.nextDue as Date;
      expect(nextDue.getTime()).toBe(
        new Date('2021-06-01T00:00:00.000Z').getTime() +
          120 * 7 * 24 * 60 * 60 * 1000,
      );
      expect(nextDue.getTime()).toBeLessThan(NOW.getTime());
    });

    it('runs each rule in its own transaction', async () => {
      fake.onSelect(recurringRules, [
        rule({ id: 'r1' }),
        rule({ id: 'r2', title: 'Phone', amountKhr: 5_000 }),
      ]);

      await service.runDue(USER, NOW);

      expect(fake.transactions).toBe(2);
      expect(fake.updated(recurringRules).map((u) => u.where.params)).toEqual([
        ['r1'],
        ['r2'],
      ]);
    });

    it('does not let a notification failure fail the run', async () => {
      fake.onSelect(recurringRules, [rule()]);
      notifications.emit.mockRejectedValueOnce(new Error('FCM down'));

      await expect(service.runDue(USER, NOW)).resolves.toMatchObject({
        posted: 1,
      });
    });
  });

  describe('runDueAll', () => {
    it('posts across users and notifies each with their own count', async () => {
      fake.onSelect(recurringRules, [
        rule({ id: 'a', userId: USER }),
        rule({
          id: 'b',
          userId: USER_2,
          nextDue: new Date('2024-05-05T00:00:00.000Z'),
        }),
        rule({
          id: 'c',
          userId: USER_2,
          nextDue: new Date('2024-06-20T00:00:00.000Z'), // not due
        }),
      ]);

      const res = await service.runDueAll(NOW);

      expect(res).toEqual({
        posted: 3,
        rulesRun: 3,
        capped: false,
        usersAffected: 2,
      });
      // Not scoped to a user: the only bound param is the cutoff.
      expect(fake.selected(recurringRules)[0].params).toEqual([
        NOW.toISOString(),
      ]);
      expect(notifications.emit).toHaveBeenCalledTimes(2);
      expect(notifications.emit).toHaveBeenCalledWith(
        USER,
        expect.objectContaining({ data: { count: 1 } }),
      );
      expect(notifications.emit).toHaveBeenCalledWith(
        USER_2,
        expect.objectContaining({ data: { count: 2 } }),
      );
    });
  });

  describe('runDueAllIfLeader', () => {
    it('skips entirely when another instance holds the advisory lock', async () => {
      fake.onExecute({ rows: [{ locked: false }] });

      await expect(service.runDueAllIfLeader(NOW)).resolves.toEqual({
        posted: 0,
        rulesRun: 0,
        capped: false,
        usersAffected: 0,
        skipped: true,
      });
      expect(fake.selected(recurringRules)).toHaveLength(0);
    });

    it('runs when it wins the lock', async () => {
      fake.onExecute({ rows: [{ locked: true }] });
      fake.onSelect(recurringRules, [rule()]);

      await expect(service.runDueAllIfLeader(NOW)).resolves.toEqual({
        posted: 1,
        rulesRun: 1,
        capped: false,
        usersAffected: 1,
        skipped: false,
      });
      // The lock is taken with pg_try_advisory_xact_lock inside a transaction.
      const [lock] = fake.of('execute');
      expect(render(lock.steps[0].args[0] as never).sql).toMatch(
        /pg_try_advisory_xact_lock/,
      );
      expect(lock.inTransaction).toBe(true);
    });
  });

  describe('create / update / remove', () => {
    const dto = {
      walletId: WALLET,
      categoryId: CAT,
      title: 'House Rent',
      amountKhr: 400_000,
      type: 'expense' as const,
      frequency: 'monthly' as const,
      nextDue: '2024-07-05T00:00:00.000Z',
    };

    it('create rejects a wallet the user does not own', async () => {
      fake.onSelect(wallets, []);

      await expect(service.create(USER, dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(fake.inserted(recurringRules)).toHaveLength(0);
    });

    it('create stores the rule with nextDue as a Date', async () => {
      fake.onSelect(wallets, [{ id: WALLET }]);
      fake.onSelect(categories, [{ id: CAT }]);
      fake.onInsert(recurringRules, [rule()]);

      await service.create(USER, dto);

      expect(fake.inserted(recurringRules)[0]).toMatchObject({
        userId: USER,
        nextDue: new Date('2024-07-05T00:00:00.000Z'),
      });
    });

    it('update 404s for a rule the user does not own', async () => {
      fake.onSelect(recurringRules, []);

      await expect(
        service.update(USER, 'rule-1', { amountKhr: 1 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('remove deletes an owned rule by id', async () => {
      fake.onSelect(recurringRules, [rule()]);

      await expect(service.remove(USER, 'rule-1')).resolves.toEqual({
        success: true,
      });
      expect(fake.deleted(recurringRules)[0].params).toEqual(['rule-1']);
    });
  });
});
