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
 * The global ValidationPipe (whitelist + forbidNonWhitelisted + transform)
 * and the DTO rules, over HTTP. Each case is a payload that must be refused
 * with 400 before any service code runs, so the suite doubles as a
 * regression net for anyone loosening a decorator.
 */
describe('request validation (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;
  let password: string;
  let C: Record<string, string>;
  let wallet: string;
  let goal: string;

  const me = () => api(app, token);

  beforeAll(async () => {
    app = await createApp();
    const u = await registerUser(app);
    token = u.accessToken;
    password = u.password;
    C = await categoryIds(app, token);
    wallet = (
      await me()
        .post('/wallets', { name: 'ABA', kind: 'bank', balanceKhr: 100_000 })
        .expect(201)
    ).body.id;
    goal = (
      await me()
        .post('/savings-goals', { name: 'Laptop', targetKhr: 2_000_000 })
        .expect(201)
    ).body.id;
  });
  afterAll(async () => {
    await deleteUser(app, token, password);
    await app.close();
  });

  const validTx = () => ({
    title: 'Lunch',
    walletId: wallet,
    categoryId: C.food,
    amountKhr: 20_000,
    type: 'expense',
    date: '2026-09-10T12:00:00Z',
  });

  it('rejects unknown fields instead of silently dropping them', async () => {
    await me()
      .post('/wallets', { name: 'X', kind: 'bank', isAdmin: true })
      .expect(400);
    await me()
      .post('/transactions', { ...validTx(), userId: 'someone-else' })
      .expect(400);
  });

  it('rejects malformed ids in the path with 400, not 404 or 500', async () => {
    await me().get('/wallets/not-a-uuid').expect(400);
    await me().delete('/budgets/123').expect(400);
    await me().patch('/recurring/abc', { amountKhr: 1 }).expect(400);
  });

  describe('wallets', () => {
    it.each([
      ['empty name', { name: '', kind: 'bank' }],
      ['unknown kind', { name: 'X', kind: 'crypto' }],
      ['negative balance', { name: 'X', kind: 'bank', balanceKhr: -1 }],
      ['fractional riel', { name: 'X', kind: 'bank', balanceKhr: 10.5 }],
      ['bad colour', { name: 'X', kind: 'bank', brandColor: 'blue' }],
    ])('%s', async (_, body) => {
      await me().post('/wallets', body).expect(400);
    });
  });

  describe('transactions', () => {
    it.each([
      ['unknown type', { type: 'refund' }],
      ['zero amount', { amountKhr: 0 }],
      ['fractional amount', { amountKhr: 1.5 }],
      ['non-uuid wallet', { walletId: 'aba' }],
      ['bad date', { date: 'yesterday' }],
      ['empty title', { title: '' }],
    ])('%s', async (_, over) => {
      await me()
        .post('/transactions', { ...validTx(), ...over })
        .expect(400);
    });

    it('validates list query params', async () => {
      await me().get('/transactions?page=0').expect(400);
      await me().get('/transactions?limit=201').expect(400);
      await me().get('/transactions?type=gift').expect(400);
      await me().get('/transactions?from=not-a-date').expect(400);
    });
  });

  describe('budgets', () => {
    it.each([
      ['month 13', { categoryId: 'x', month: '2026-13', limitKhr: 1 }],
      ['month without zero-pad', { month: '2026-9', limitKhr: 1 }],
      ['zero limit', { month: '2026-09', limitKhr: 0 }],
      ['fractional limit', { month: '2026-09', limitKhr: 100.5 }],
      [
        'non-uuid category',
        { categoryId: 'food', month: '2026-09', limitKhr: 1 },
      ],
    ])('%s', async (_, over) => {
      await me()
        .post('/budgets', { categoryId: C.food, ...over })
        .expect(400);
    });

    it('validates the month query', async () => {
      await me().get('/budgets?month=September').expect(400);
    });
  });

  describe('savings goals', () => {
    it.each([
      ['zero target', { name: 'X', targetKhr: 0 }],
      ['negative saved', { name: 'X', targetKhr: 1, savedKhr: -1 }],
      ['bad colour', { name: 'X', targetKhr: 1, color: 'teal' }],
      ['empty name', { name: '', targetKhr: 1 }],
    ])('%s', async (_, body) => {
      await me().post('/savings-goals', body).expect(400);
    });

    it('add-funds needs a positive integer', async () => {
      await me()
        .post(`/savings-goals/${goal}/add-funds`, { amountKhr: 0 })
        .expect(400);
      await me()
        .post(`/savings-goals/${goal}/add-funds`, { amountKhr: 0.5 })
        .expect(400);
      await me().post(`/savings-goals/${goal}/add-funds`, {}).expect(400);
    });
  });

  describe('recurring', () => {
    const valid = () => ({
      title: 'Rent',
      walletId: wallet,
      categoryId: C.bills,
      amountKhr: 400_000,
      type: 'expense',
      frequency: 'monthly',
      nextDue: '2030-01-01T00:00:00Z',
    });

    it.each([
      ['unknown frequency', { frequency: 'daily' }],
      ['bad nextDue', { nextDue: 'next month' }],
      ['zero amount', { amountKhr: 0 }],
      ['unknown type', { type: 'transfer' }],
      ['note too long', { note: 'x'.repeat(501) }],
    ])('%s', async (_, over) => {
      await me()
        .post('/recurring', { ...valid(), ...over })
        .expect(400);
    });
  });

  describe('notifications', () => {
    it.each([
      ['bad periodKey', { periodKey: 'Sept', spentKhr: 1, count: 1 }],
      ['negative spend', { periodKey: '2026-09', spentKhr: -1, count: 1 }],
      ['missing count', { periodKey: '2026-09', spentKhr: 1 }],
    ])('insight: %s', async (_, body) => {
      await me().post('/notifications/insight', body).expect(400);
    });

    it('device registration validates platform and token', async () => {
      await me()
        .post('/notifications/devices', { token: 't', platform: 'blackberry' })
        .expect(400);
      await me().post('/notifications/devices', { token: '' }).expect(400);
    });
  });

  describe('auth', () => {
    it.each([
      [
        'not an email',
        { email: 'nope', password: 'Str0ngPass!', fullName: 'X' },
      ],
      ['short password', { email: 'a@b.co', password: 'short', fullName: 'X' }],
    ])('register: %s', async (_, body) => {
      await api(app).post('/auth/register', body).expect(400);
    });

    it('change-password needs both fields', async () => {
      await me()
        .post('/auth/me/change-password', { currentPassword: password })
        .expect(400);
    });
  });
});
