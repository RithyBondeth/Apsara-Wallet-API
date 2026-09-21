import { BadRequestException, NotFoundException } from '@nestjs/common';
import { budgets, categories, transactions } from '../../database/schema';
import { FakeDb } from '../../../test/support/fake-db';
import { BudgetsService } from './budgets.service';

const USER = '11111111-1111-4111-8111-111111111111';
const FOOD = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const TRANSPORT = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const BUDGET = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

describe('BudgetsService', () => {
  let fake: FakeDb;
  let service: BudgetsService;

  beforeEach(() => {
    fake = new FakeDb();
    service = new BudgetsService(fake.db);
  });

  describe('list', () => {
    it('merges live spend into each budget, defaulting untouched categories to 0', async () => {
      fake.onSelect(budgets, [
        { id: 'b1', categoryId: FOOD, month: '2024-05', limitKhr: 700_000 },
        {
          id: 'b2',
          categoryId: TRANSPORT,
          month: '2024-05',
          limitKhr: 400_000,
        },
      ]);
      // Postgres returns bigint sums as strings; only Food has spend.
      fake.onSelect(transactions, [{ categoryId: FOOD, spent: '442000' }]);

      const res = await service.list(USER, '2024-05');

      expect(res.month).toBe('2024-05');
      expect(res.budgets).toEqual([
        expect.objectContaining({ id: 'b1', spentKhr: 442_000 }),
        expect.objectContaining({ id: 'b2', spentKhr: 0 }),
      ]);
      expect(typeof res.budgets[0].spentKhr).toBe('number');
    });

    it('sums expenses over the month as a half-open UTC range', async () => {
      fake.onSelect(budgets, []);
      fake.onSelect(transactions, []);

      await service.list(USER, '2024-02');

      const [budgetQuery] = fake.selected(budgets);
      expect(budgetQuery.params).toEqual([USER, '2024-02']);
      const [spendQuery] = fake.selected(transactions);
      // Leap year: Feb 2024 runs to Mar 1, exclusive.
      expect(spendQuery.params).toEqual([
        USER,
        'expense',
        '2024-02-01T00:00:00.000Z',
        '2024-03-01T00:00:00.000Z',
      ]);
    });

    it('defaults to the current UTC month', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2024-12-31T23:30:00Z'));
      try {
        fake.onSelect(budgets, []);
        fake.onSelect(transactions, []);

        const res = await service.list(USER);

        expect(res.month).toBe('2024-12');
        expect(fake.selected(transactions)[0].params).toEqual([
          USER,
          'expense',
          '2024-12-01T00:00:00.000Z',
          '2025-01-01T00:00:00.000Z',
        ]);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('upsert', () => {
    const dto = { categoryId: FOOD, month: '2024-05', limitKhr: 700_000 };

    it('rejects a category that is neither system nor the user’s own', async () => {
      fake.onSelect(categories, []);

      await expect(service.upsert(USER, dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(fake.inserted(budgets)).toHaveLength(0);
    });

    it('inserts, upserting on (user, month, category)', async () => {
      fake.onSelect(categories, [{ id: FOOD }]);
      fake.onInsert(budgets, [{ id: BUDGET, ...dto }]);

      const row = await service.upsert(USER, dto);

      expect(row).toEqual({ id: BUDGET, ...dto });
      expect(fake.inserted(budgets)[0]).toEqual({ userId: USER, ...dto });
      const [call] = fake.of('insert', budgets);
      const conflict = call.steps.find((s) => s.name === 'onConflictDoUpdate');
      expect(conflict?.args[0]).toMatchObject({
        target: [budgets.userId, budgets.month, budgets.categoryId],
        set: expect.objectContaining({ limitKhr: 700_000 }) as unknown,
      });
    });
  });

  describe('remove', () => {
    it('404s for a budget the user does not own', async () => {
      fake.onSelect(budgets, []);

      await expect(service.remove(USER, BUDGET)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(fake.deleted(budgets)).toHaveLength(0);
    });

    it('deletes the owned budget by id', async () => {
      fake.onSelect(budgets, [{ id: BUDGET }]);

      await expect(service.remove(USER, BUDGET)).resolves.toEqual({
        success: true,
      });
      expect(fake.selected(budgets)[0].params).toEqual([BUDGET, USER]);
      expect(fake.deleted(budgets)[0].params).toEqual([BUDGET]);
    });
  });
});
