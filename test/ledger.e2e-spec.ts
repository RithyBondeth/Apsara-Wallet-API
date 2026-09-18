import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import {
  api,
  categoryIds,
  createApp,
  deleteUser,
  registerUser,
} from './support/app';

/**
 * The money invariants: every write to the ledger moves the owning wallet's
 * balance by exactly its signed amount, and every reversal puts it back.
 */
describe('ledger (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;
  let password: string;
  let C: Record<string, string>;
  let aba: string;
  let cash: string;

  const bal = async (id: string) =>
    (await api(app, token).get(`/wallets/${id}`).expect(200)).body
      .balanceKhr as number;

  beforeAll(async () => {
    app = await createApp();
    const u = await registerUser(app);
    token = u.accessToken;
    password = u.password;
    C = await categoryIds(app, token);
    expect(C.food).toBeDefined();
    aba = (
      await api(app, token)
        .post('/wallets', {
          name: 'ABA',
          kind: 'bank',
          balanceKhr: 1_000_000,
          isPrimary: true,
        })
        .expect(201)
    ).body.id;
    cash = (
      await api(app, token)
        .post('/wallets', { name: 'Cash', kind: 'cash', balanceKhr: 200_000 })
        .expect(201)
    ).body.id;
  });
  afterAll(async () => {
    await deleteUser(app, token, password);
    await app.close();
  });

  it('summary sums every wallet', async () => {
    const s = await api(app, token).get('/wallets/summary').expect(200);
    expect(s.body.totalBalanceKhr).toBe(1_200_000);
  });

  it('a new primary clears the old one; reorder rejects foreign ids', async () => {
    const wing = (
      await api(app, token)
        .post('/wallets', { name: 'Wing', kind: 'ewallet', isPrimary: true })
        .expect(201)
    ).body;
    expect((await api(app, token).get(`/wallets/${aba}`)).body.isPrimary).toBe(
      false,
    );
    await api(app, token)
      .patch('/wallets/reorder', {
        ids: ['00000000-0000-4000-8000-000000000000'],
      })
      .expect(400);
    const ordered = await api(app, token)
      .patch('/wallets/reorder', { ids: [cash, aba, wing.id] })
      .expect(200);
    expect(ordered.body[0].name).toBe('Cash');
    await api(app, token).delete(`/wallets/${wing.id}`).expect(200);
  });

  it('create / update / move / flip / delete keep wallet balances exact', async () => {
    const tx = (
      await api(app, token)
        .post('/transactions', {
          title: 'Lunch',
          walletId: aba,
          categoryId: C.food,
          amountKhr: 30_000,
          type: 'expense',
          date: '2026-09-10T12:00:00Z',
        })
        .expect(201)
    ).body;
    expect(await bal(aba)).toBe(970_000);

    await api(app, token)
      .post('/transactions', {
        title: 'Salary',
        walletId: aba,
        categoryId: C.salary,
        amountKhr: 4_000_000,
        type: 'income',
        date: '2026-09-01T09:00:00Z',
      })
      .expect(201);
    expect(await bal(aba)).toBe(4_970_000);

    await api(app, token)
      .patch(`/transactions/${tx.id}`, { amountKhr: 50_000 })
      .expect(200);
    expect(await bal(aba)).toBe(4_950_000);

    await api(app, token)
      .patch(`/transactions/${tx.id}`, { walletId: cash })
      .expect(200);
    expect(await bal(aba)).toBe(5_000_000);
    expect(await bal(cash)).toBe(150_000);

    await api(app, token)
      .patch(`/transactions/${tx.id}`, { type: 'income' })
      .expect(200);
    expect(await bal(cash)).toBe(250_000);
    await api(app, token)
      .patch(`/transactions/${tx.id}`, { type: 'expense' })
      .expect(200);

    await api(app, token).delete(`/transactions/${tx.id}`).expect(200);
    expect(await bal(cash)).toBe(200_000);
    await api(app, token).get(`/transactions/${tx.id}`).expect(404);
  });

  it('validates ownership, amounts and filters', async () => {
    await api(app, token)
      .post('/transactions', {
        title: 'x',
        walletId: '00000000-0000-4000-8000-000000000000',
        categoryId: C.food,
        amountKhr: 1,
        type: 'expense',
        date: '2026-09-10T12:00:00Z',
      })
      .expect(400);
    await api(app, token)
      .post('/transactions', {
        title: 'x',
        walletId: aba,
        categoryId: C.food,
        amountKhr: 0,
        type: 'expense',
        date: '2026-09-10T12:00:00Z',
      })
      .expect(400);
    const income = await api(app, token)
      .get('/transactions?type=income')
      .expect(200);
    expect(income.body.meta.total).toBe(1);
    const paged = await api(app, token)
      .get('/transactions?limit=1')
      .expect(200);
    expect(paged.body.meta.totalPages).toBe(1);
  });

  it('transfers move money between own wallets, stay out of the ledger, and cannot overdraw', async () => {
    await api(app, token)
      .post('/transfers', {
        fromWalletId: aba,
        toWalletId: cash,
        amountKhr: 100_000,
        date: '2026-09-11T10:00:00Z',
      })
      .expect(201);
    expect(await bal(aba)).toBe(4_900_000);
    expect(await bal(cash)).toBe(300_000);
    await api(app, token)
      .post('/transfers', {
        fromWalletId: aba,
        toWalletId: aba,
        amountKhr: 1,
        date: '2026-09-11T10:00:00Z',
      })
      .expect(400);
    await api(app, token)
      .post('/transfers', {
        fromWalletId: cash,
        toWalletId: aba,
        amountKhr: 9_999_999,
        date: '2026-09-11T10:00:00Z',
      })
      .expect(400);
    expect(await bal(cash)).toBe(300_000);
    const income = await api(app, token)
      .get('/transactions?type=income')
      .expect(200);
    expect(income.body.meta.total).toBe(1);
  });

  it('budget alert fires exactly on the crossing transaction', async () => {
    await api(app, token)
      .post('/budgets', {
        categoryId: C.food,
        month: '2026-09',
        limitKhr: 100_000,
      })
      .expect(201);
    const post = (title: string, day: number) =>
      api(app, token)
        .post('/transactions', {
          title,
          walletId: aba,
          categoryId: C.food,
          amountKhr: 60_000,
          type: 'expense',
          date: `2026-09-${day}T12:00:00Z`,
        })
        .expect(201);
    await post('Dinner', 12);
    const before = (await api(app, token).get('/notifications')).body.length;
    await post('Dinner 2', 13);
    const after = (await api(app, token).get('/notifications')).body;
    expect(after.length).toBe(before + 1);
    expect(JSON.stringify(after[0]).toLowerCase()).toContain('budget');
    const budgets = await api(app, token)
      .get('/budgets?month=2026-09')
      .expect(200);
    expect(budgets.body.budgets[0].spentKhr).toBe(120_000);
    const upsert = await api(app, token)
      .post('/budgets', {
        categoryId: C.food,
        month: '2026-09',
        limitKhr: 300_000,
      })
      .expect(201);
    expect(upsert.body.limitKhr).toBe(300_000);
  });

  it('recurring catch-up posts each missed occurrence once and advances nextDue', async () => {
    const rule = (
      await api(app, token)
        .post('/recurring', {
          title: 'Rent',
          walletId: aba,
          categoryId: C.bills,
          amountKhr: 500_000,
          type: 'expense',
          frequency: 'monthly',
          nextDue: '2026-08-01T00:00:00Z',
        })
        .expect(201)
    ).body;
    const b0 = await bal(aba);
    const run = await api(app, token).post('/recurring/run').expect(201);
    expect(run.body.posted).toBeGreaterThanOrEqual(2);
    expect(await bal(aba)).toBe(b0 - run.body.posted * 500_000);
    const again = await api(app, token).post('/recurring/run').expect(201);
    expect(again.body.posted).toBe(0);
    // FK restrict surfaces as 409, not 500.
    await api(app, token).delete(`/wallets/${aba}`).expect(409);
    await api(app, token).delete(`/categories/${C.food}`).expect(403);
    await api(app, token).delete(`/recurring/${rule.id}`).expect(200);
  });

  it('user categories can be created and refuse deletion while in use', async () => {
    const uc = (
      await api(app, token)
        .post('/categories', {
          name: 'Coffee',
          slug: 'coffee',
          type: 'expense',
          icon: 'coffee',
          color: '#6D4C41',
        })
        .expect(201)
    ).body;
    const tx = (
      await api(app, token)
        .post('/transactions', {
          title: 'Latte',
          walletId: aba,
          categoryId: uc.id,
          amountKhr: 8_000,
          type: 'expense',
          date: '2026-09-14T08:00:00Z',
        })
        .expect(201)
    ).body;
    await api(app, token).delete(`/categories/${uc.id}`).expect(409);
    await api(app, token).delete(`/transactions/${tx.id}`).expect(200);
    await api(app, token).delete(`/categories/${uc.id}`).expect(200);
  });

  it('savings goals track without moving wallet money', async () => {
    const g = (
      await api(app, token)
        .post('/savings-goals', { name: 'Motorbike', targetKhr: 8_000_000 })
        .expect(201)
    ).body;
    const b0 = await bal(aba);
    const add = await api(app, token)
      .post(`/savings-goals/${g.id}/add-funds`, { amountKhr: 500_000 })
      .expect(201);
    expect(add.body.savedKhr).toBe(500_000);
    expect(await bal(aba)).toBe(b0);
    await api(app, token).delete(`/savings-goals/${g.id}`).expect(200);
  });

  it('notifications: read, read-all, insight dedup, device tokens, feedback, fx, health', async () => {
    const n = (await api(app, token).get('/notifications').expect(200)).body;
    expect(n.length).toBeGreaterThan(0);
    const read = await api(app, token)
      .patch(`/notifications/${n[0].id}/read`)
      .expect(200);
    expect(read.body.read).toBe(true);
    await api(app, token).post('/notifications/read-all').expect(201);
    const first = await api(app, token)
      .post('/notifications/insight', {
        periodKey: '2026-09',
        spentKhr: 620_000,
        count: 5,
      })
      .expect(201);
    expect(first.body.created).toBe(true);
    const dup = await api(app, token)
      .post('/notifications/insight', {
        periodKey: '2026-09',
        spentKhr: 620_000,
        count: 5,
      })
      .expect(201);
    expect(dup.body.created).toBe(false);
    await api(app, token)
      .post('/notifications/devices', { token: 'fake-fcm', platform: 'ios' })
      .expect(201);
    await api(app, token).delete('/notifications/devices/fake-fcm').expect(200);
    const fb = await api(app, token)
      .post('/feedback', { rating: 5, comment: 'great', platform: 'ios' })
      .expect(201);
    expect(fb.body.rating).toBe(5);
    const fx = await api(app, token).get('/fx/rates').expect(200);
    expect(fx.body.khrPerUsd).toBeGreaterThan(0);
    const h = await api(app).get('/health').expect(200);
    expect(h.body.status).toBe('ok');
  });
});
