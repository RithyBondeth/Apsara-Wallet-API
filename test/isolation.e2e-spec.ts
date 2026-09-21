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
 * Tenant isolation over real HTTP: everything user A owns is invisible to
 * user B — reads 404, writes 404, and referencing A's ids in B's payloads is
 * rejected. Every list B fetches is free of A's rows.
 *
 * Guards are attached per controller (not globally), so a new endpoint that
 * forgets the user scope in its query is exactly what this suite catches.
 */
describe('tenant isolation (e2e)', () => {
  let app: INestApplication<App>;
  let a: Awaited<ReturnType<typeof registerUser>>;
  let b: Awaited<ReturnType<typeof registerUser>>;
  let C: Record<string, string>;

  // Everything A owns.
  let walletA: string;
  let walletA2: string;
  let txA: string;
  let budgetA: string;
  let goalA: string;
  let ruleA: string;
  let notifA: string;
  let userCategoryA: string;

  const A = () => api(app, a.accessToken);
  const B = () => api(app, b.accessToken);

  beforeAll(async () => {
    app = await createApp();
    a = await registerUser(app);
    b = await registerUser(app);
    C = await categoryIds(app, a.accessToken);

    walletA = (
      await A()
        .post('/wallets', { name: 'ABA', kind: 'bank', balanceKhr: 1_000_000 })
        .expect(201)
    ).body.id;
    walletA2 = (
      await A()
        .post('/wallets', { name: 'Cash', kind: 'cash', balanceKhr: 100_000 })
        .expect(201)
    ).body.id;
    txA = (
      await A()
        .post('/transactions', {
          title: 'Lunch',
          walletId: walletA,
          categoryId: C.food,
          amountKhr: 20_000,
          type: 'expense',
          date: '2026-09-10T12:00:00Z',
        })
        .expect(201)
    ).body.id;
    budgetA = (
      await A()
        .post('/budgets', {
          categoryId: C.food,
          month: '2026-09',
          limitKhr: 500_000,
        })
        .expect(201)
    ).body.id;
    goalA = (
      await A()
        .post('/savings-goals', { name: 'Motorbike', targetKhr: 8_000_000 })
        .expect(201)
    ).body.id;
    ruleA = (
      await A()
        .post('/recurring', {
          title: 'Rent',
          walletId: walletA,
          categoryId: C.bills,
          amountKhr: 400_000,
          type: 'expense',
          frequency: 'monthly',
          nextDue: '2030-01-01T00:00:00Z',
        })
        .expect(201)
    ).body.id;
    userCategoryA = (
      await A()
        .post('/categories', {
          name: 'Coffee',
          slug: 'coffee-a',
          type: 'expense',
          icon: 'coffee',
          color: '#6D4C41',
        })
        .expect(201)
    ).body.id;
    // A notification A owns (the insight digest creates one deterministically).
    await A()
      .post('/notifications/insight', {
        periodKey: '2026-09',
        spentKhr: 20_000,
        count: 1,
      })
      .expect(201);
    notifA = (await A().get('/notifications').expect(200)).body[0].id;
  });

  afterAll(async () => {
    await deleteUser(app, a.accessToken, a.password);
    await deleteUser(app, b.accessToken, b.password);
    await app.close();
  });

  it('wallets: B cannot read, update, delete or transfer with A’s wallets', async () => {
    await B().get(`/wallets/${walletA}`).expect(404);
    await B().patch(`/wallets/${walletA}`, { name: 'Mine now' }).expect(404);
    await B().delete(`/wallets/${walletA}`).expect(404);
    await B()
      .patch('/wallets/reorder', { ids: [walletA, walletA2] })
      .expect(400);
    await B()
      .post('/transfers', {
        fromWalletId: walletA,
        toWalletId: walletA2,
        amountKhr: 10_000,
        date: '2026-09-11T00:00:00Z',
      })
      .expect(400);
    // And A's balance is untouched by all of the above.
    const w = await A().get(`/wallets/${walletA}`).expect(200);
    expect(w.body.balanceKhr).toBe(1_000_000 - 20_000);
    expect(w.body.name).toBe('ABA');
  });

  it('transactions: B cannot read, edit, delete or post into A’s wallet', async () => {
    await B().get(`/transactions/${txA}`).expect(404);
    await B().patch(`/transactions/${txA}`, { amountKhr: 1 }).expect(404);
    await B().delete(`/transactions/${txA}`).expect(404);
    await B()
      .post('/transactions', {
        title: 'Sneaky',
        walletId: walletA,
        categoryId: C.food,
        amountKhr: 5_000,
        type: 'expense',
        date: '2026-09-11T00:00:00Z',
      })
      .expect(400);
    // Filtering by A's wallet id yields nothing rather than A's rows.
    const list = await B().get(`/transactions?walletId=${walletA}`).expect(200);
    expect(list.body.data).toEqual([]);
    expect(list.body.meta.total).toBe(0);
  });

  it('categories: B cannot use, edit or delete A’s custom category', async () => {
    await B()
      .post('/transactions', {
        title: 'Latte',
        walletId: walletA2, // not B's either, but the category check comes first
        categoryId: userCategoryA,
        amountKhr: 5_000,
        type: 'expense',
        date: '2026-09-11T00:00:00Z',
      })
      .expect(400);
    await B()
      .patch(`/categories/${userCategoryA}`, { name: 'Renamed' })
      .expect(404);
    await B().delete(`/categories/${userCategoryA}`).expect(404);
    await B()
      .post('/budgets', {
        categoryId: userCategoryA,
        month: '2026-09',
        limitKhr: 1_000,
      })
      .expect(400);
    const cats = await B().get('/categories').expect(200);
    expect(JSON.stringify(cats.body)).not.toContain(userCategoryA);
  });

  it('budgets: B cannot delete A’s budget and never sees it', async () => {
    await B().delete(`/budgets/${budgetA}`).expect(404);
    const list = await B().get('/budgets?month=2026-09').expect(200);
    expect(list.body.budgets).toEqual([]);
    // A's spend is still computed only from A's ledger.
    const mine = await A().get('/budgets?month=2026-09').expect(200);
    expect(mine.body.budgets[0].spentKhr).toBe(20_000);
  });

  it('savings goals: B cannot update, fund or delete A’s goal', async () => {
    await B().patch(`/savings-goals/${goalA}`, { name: 'Mine' }).expect(404);
    await B()
      .post(`/savings-goals/${goalA}/add-funds`, { amountKhr: 1_000 })
      .expect(404);
    await B().delete(`/savings-goals/${goalA}`).expect(404);
    expect((await B().get('/savings-goals').expect(200)).body).toEqual([]);
    const g = (await A().get('/savings-goals').expect(200)).body[0];
    expect(g.savedKhr).toBe(0);
  });

  it('recurring: B cannot update, delete or run A’s rules', async () => {
    await B().patch(`/recurring/${ruleA}`, { amountKhr: 1 }).expect(404);
    await B().delete(`/recurring/${ruleA}`).expect(404);
    expect((await B().get('/recurring').expect(200)).body).toEqual([]);
    // B running the materialiser only touches B's rules (there are none).
    const run = await B().post('/recurring/run').expect(201);
    expect(run.body).toMatchObject({ posted: 0, rulesRun: 0 });
    const w = await A().get(`/wallets/${walletA}`).expect(200);
    expect(w.body.balanceKhr).toBe(980_000);
  });

  it('notifications: B cannot mark A’s notification read and never lists it', async () => {
    await B().patch(`/notifications/${notifA}/read`).expect(404);
    const list = await B().get('/notifications').expect(200);
    const listed = list.body as Array<{ id: string }>;
    expect(listed.map((n) => n.id)).not.toContain(notifA);
    // read-all is scoped: A's notification stays unread.
    await B().post('/notifications/read-all').expect(201);
    const mine = await A().get('/notifications').expect(200);
    const rows = mine.body as Array<{ id: string; read: boolean }>;
    expect(rows.find((x) => x.id === notifA)?.read).toBe(false);
  });

  it('every list B fetches is empty of A’s rows', async () => {
    const [wallets, txs, goals, rules, notifs] = await Promise.all([
      B().get('/wallets').expect(200),
      B().get('/transactions').expect(200),
      B().get('/savings-goals').expect(200),
      B().get('/recurring').expect(200),
      B().get('/notifications').expect(200),
    ]);
    const blob = JSON.stringify([
      wallets.body,
      txs.body,
      goals.body,
      rules.body,
      notifs.body,
    ]);
    for (const id of [walletA, walletA2, txA, goalA, ruleA, notifA]) {
      expect(blob).not.toContain(id);
    }
  });
});
