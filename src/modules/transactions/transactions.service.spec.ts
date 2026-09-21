import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  budgets,
  categories,
  transactions,
  wallets,
} from '../../database/schema';
import {
  FakeDb,
  fakeNotifications,
  render,
} from '../../../test/support/fake-db';
import { NotificationsService } from '../notifications/notifications.service';
import { TransactionType } from './dto/transaction.dto';
import { TransactionsService } from './transactions.service';

const USER = '11111111-1111-4111-8111-111111111111';
const WALLET = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const WALLET_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CAT = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const TX = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

function createDto(
  over: Partial<{ type: TransactionType; amountKhr: number }> = {},
) {
  return {
    walletId: WALLET,
    categoryId: CAT,
    title: 'Lunch',
    amountKhr: 20_000,
    type: TransactionType.Expense,
    date: '2024-05-20T09:00:00.000Z',
    ...over,
  };
}

const existingExpense = {
  id: TX,
  userId: USER,
  walletId: WALLET,
  categoryId: CAT,
  title: 'Lunch',
  amountKhr: 20_000,
  type: 'expense',
  note: null,
  date: new Date('2024-05-20T09:00:00.000Z'),
};

/** The signed riel delta a wallet update applies, from its rendered SQL. */
function deltaOf(update: { set: Record<string, unknown> }): number {
  const { sql, params } = render(update.set.balanceKhr as never);
  const n = Number(params[0]);
  return sql.includes('- $1') ? -n : n;
}

describe('TransactionsService', () => {
  let fake: FakeDb;
  let notifications: ReturnType<typeof fakeNotifications>;
  let service: TransactionsService;

  beforeEach(() => {
    fake = new FakeDb();
    notifications = fakeNotifications();
    service = new TransactionsService(
      fake.db,
      notifications as unknown as NotificationsService,
    );
  });

  /** Ownership + category checks pass. */
  function allowWalletAndCategory() {
    fake.onSelect(wallets, [{ id: WALLET }]);
    fake.onSelect(categories, [{ id: CAT }]);
  }

  describe('create', () => {
    it('rejects a wallet the user does not own, without inserting', async () => {
      fake.onSelect(wallets, []);

      await expect(service.create(USER, createDto())).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(fake.inserted(transactions)).toHaveLength(0);
      expect(fake.transactions).toBe(0);
    });

    it('rejects a category that is neither system nor owned by the user', async () => {
      fake.onSelect(wallets, [{ id: WALLET }]);
      fake.onSelect(categories, []);

      await expect(service.create(USER, createDto())).rejects.toThrow(
        'Category not found',
      );
      expect(fake.inserted(transactions)).toHaveLength(0);
    });

    it('scopes the category check to system categories or the user’s own', async () => {
      allowWalletAndCategory();
      fake.onInsert(transactions, [existingExpense]);

      await service.create(USER, createDto());

      const [categoryCheck] = fake.selected(categories);
      expect(categoryCheck.sql).toMatch(/is null/i);
      expect(categoryCheck.params).toEqual([CAT, USER]);
    });

    it('inserts an expense and debits the wallet in the same transaction', async () => {
      allowWalletAndCategory();
      fake.onInsert(transactions, [existingExpense]);

      const row = await service.create(USER, createDto());

      expect(row).toBe(existingExpense);
      expect(fake.transactions).toBe(1);
      expect(fake.inserted(transactions)[0]).toMatchObject({
        userId: USER,
        walletId: WALLET,
        amountKhr: 20_000,
        type: 'expense',
        date: new Date('2024-05-20T09:00:00.000Z'),
      });

      const [update] = fake.updated(wallets);
      expect(update.inTransaction).toBe(true);
      expect(deltaOf(update)).toBe(-20_000);
      // Scoped to the wallet AND the user, never just the wallet id.
      expect(update.where.params).toEqual([WALLET, USER]);
    });

    it('credits the wallet for income', async () => {
      allowWalletAndCategory();
      fake.onInsert(transactions, [
        { ...existingExpense, type: 'income', amountKhr: 3_500_000 },
      ]);

      await service.create(
        USER,
        createDto({ type: TransactionType.Income, amountKhr: 3_500_000 }),
      );

      expect(deltaOf(fake.updated(wallets)[0])).toBe(3_500_000);
    });

    describe('budget alert', () => {
      function withBudget(limitKhr: number, spentAfter: number) {
        allowWalletAndCategory();
        fake.onInsert(transactions, [existingExpense]);
        fake.onSelect(budgets, [{ limitKhr }]);
        fake.onSelect(transactions, [{ spent: String(spentAfter) }]);
        fake.onSelect(categories, [{ name: 'Food & Dining' }]);
      }

      it('fires once, on the expense that crosses the monthly limit', async () => {
        // 700k limit; 690k spent before, this 20k makes 710k.
        withBudget(700_000, 710_000);

        await service.create(USER, createDto());

        expect(notifications.emit).toHaveBeenCalledTimes(1);
        expect(notifications.emit).toHaveBeenCalledWith(
          USER,
          expect.objectContaining({
            type: 'budget_alert',
            data: { category: 'Food & Dining' },
          }),
        );
      });

      it('fires when the expense lands exactly on the limit', async () => {
        withBudget(700_000, 700_000);
        await service.create(USER, createDto());
        expect(notifications.emit).toHaveBeenCalledTimes(1);
      });

      it('stays quiet while still under budget', async () => {
        withBudget(700_000, 650_000);
        await service.create(USER, createDto());
        expect(notifications.emit).not.toHaveBeenCalled();
      });

      it('does not fire again once the category was already over budget', async () => {
        // 720k before this 20k → 740k: crossed on an earlier transaction.
        withBudget(700_000, 740_000);
        await service.create(USER, createDto());
        expect(notifications.emit).not.toHaveBeenCalled();
      });

      it('does nothing when the category has no budget this month', async () => {
        allowWalletAndCategory();
        fake.onInsert(transactions, [existingExpense]);
        fake.onSelect(budgets, []);

        await service.create(USER, createDto());

        expect(notifications.emit).not.toHaveBeenCalled();
        // No spend query either: the budget lookup short-circuits.
        expect(fake.selected(transactions)).toHaveLength(0);
      });

      it('never checks budgets for income', async () => {
        allowWalletAndCategory();
        fake.onInsert(transactions, [existingExpense]);

        await service.create(USER, createDto({ type: TransactionType.Income }));

        expect(fake.selected(budgets)).toHaveLength(0);
        expect(notifications.emit).not.toHaveBeenCalled();
      });

      it('looks at the transaction’s own month, as a half-open UTC range', async () => {
        withBudget(700_000, 710_000);

        await service.create(USER, createDto({ amountKhr: 20_000 }));

        const [budgetLookup] = fake.selected(budgets);
        expect(budgetLookup.params).toEqual([USER, '2024-05', CAT]);
        const [spendLookup] = fake.selected(transactions);
        // Dates render as ISO strings once bound.
        expect(spendLookup.params).toEqual([
          USER,
          CAT,
          'expense',
          '2024-05-01T00:00:00.000Z',
          '2024-06-01T00:00:00.000Z',
        ]);
      });

      it('never lets a notification failure break the create', async () => {
        withBudget(700_000, 710_000);
        notifications.emit.mockRejectedValueOnce(new Error('FCM down'));

        await expect(service.create(USER, createDto())).resolves.toBe(
          existingExpense,
        );
      });
    });
  });

  describe('update', () => {
    it('404s for a transaction the user does not own', async () => {
      fake.onSelect(transactions, []);

      await expect(
        service.update(USER, TX, { amountKhr: 1 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(fake.transactions).toBe(0);
    });

    it('reverses the old effect and applies the new one when amount changes', async () => {
      fake.onSelect(transactions, [existingExpense]);
      fake.onUpdate(transactions, [{ ...existingExpense, amountKhr: 35_000 }]);

      await service.update(USER, TX, { amountKhr: 35_000 });

      const updates = fake.updated(wallets);
      expect(updates.map(deltaOf)).toEqual([20_000, -35_000]);
      expect(updates.every((u) => u.where.params[0] === WALLET)).toBe(true);
      expect(updates.every((u) => u.inTransaction)).toBe(true);
    });

    it('flips the sign when an expense becomes income', async () => {
      fake.onSelect(transactions, [existingExpense]);
      fake.onUpdate(transactions, [{ ...existingExpense, type: 'income' }]);

      await service.update(USER, TX, { type: TransactionType.Income });

      expect(fake.updated(wallets).map(deltaOf)).toEqual([20_000, 20_000]);
    });

    it('moves the effect between wallets when walletId changes', async () => {
      fake.onSelect(transactions, [existingExpense]);
      fake.onSelect(wallets, [{ id: WALLET_2 }]); // new wallet is owned
      fake.onUpdate(transactions, [{ ...existingExpense, walletId: WALLET_2 }]);

      await service.update(USER, TX, { walletId: WALLET_2 });

      const [reverse, apply] = fake.updated(wallets);
      expect(deltaOf(reverse)).toBe(20_000);
      expect(reverse.where.params[0]).toBe(WALLET);
      expect(deltaOf(apply)).toBe(-20_000);
      expect(apply.where.params[0]).toBe(WALLET_2);
    });

    it('refuses to move a transaction into a wallet the user does not own', async () => {
      fake.onSelect(transactions, [existingExpense]);
      fake.onSelect(wallets, []);

      await expect(
        service.update(USER, TX, { walletId: WALLET_2 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(fake.updated(wallets)).toHaveLength(0);
    });

    it('converts a string date into a Date on the row', async () => {
      fake.onSelect(transactions, [existingExpense]);
      fake.onUpdate(transactions, [existingExpense]);

      await service.update(USER, TX, { date: '2024-05-21T00:00:00.000Z' });

      const [{ set }] = fake.updated(transactions);
      expect(set.date).toEqual(new Date('2024-05-21T00:00:00.000Z'));
    });
  });

  describe('remove', () => {
    it('404s for a transaction the user does not own', async () => {
      fake.onSelect(transactions, []);

      await expect(service.remove(USER, TX)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(fake.deleted(transactions)).toHaveLength(0);
    });

    it('deletes the row and gives the money back to the wallet', async () => {
      fake.onSelect(transactions, [existingExpense]);

      await expect(service.remove(USER, TX)).resolves.toEqual({
        success: true,
      });

      expect(fake.deleted(transactions)[0].params).toEqual([TX]);
      const [update] = fake.updated(wallets);
      expect(deltaOf(update)).toBe(20_000);
      expect(update.inTransaction).toBe(true);
    });

    it('debits the wallet when removing income', async () => {
      fake.onSelect(transactions, [
        { ...existingExpense, type: 'income', amountKhr: 100_000 },
      ]);

      await service.remove(USER, TX);

      expect(deltaOf(fake.updated(wallets)[0])).toBe(-100_000);
    });
  });

  describe('listAllCategory', () => {
    it('paginates and reports totalPages from the count query', async () => {
      fake.onSelect(transactions, [existingExpense]);
      fake.onSelect(transactions, [{ total: 41 }]);

      const res = await service.listAllCategory(USER, {
        page: 3,
        limit: 20,
      });

      expect(res.data).toEqual([existingExpense]);
      expect(res.meta).toEqual({
        page: 3,
        limit: 20,
        total: 41,
        totalPages: 3,
      });
      const [rows] = fake.of('select', transactions);
      expect(rows.steps.find((s) => s.name === 'offset')?.args).toEqual([40]);
      expect(rows.steps.find((s) => s.name === 'limit')?.args).toEqual([20]);
    });

    it('applies every filter the query carries', async () => {
      fake.onSelect(transactions, []);
      fake.onSelect(transactions, [{ total: 0 }]);

      await service.listAllCategory(USER, {
        page: 1,
        limit: 10,
        type: TransactionType.Expense,
        categoryId: CAT,
        walletId: WALLET,
        from: '2024-05-01T00:00:00.000Z',
        to: '2024-05-31T23:59:59.000Z',
      });

      const [rows] = fake.selected(transactions);
      expect(rows.params).toEqual([
        USER,
        'expense',
        CAT,
        WALLET,
        '2024-05-01T00:00:00.000Z',
        '2024-05-31T23:59:59.000Z',
      ]);
    });
  });
});
