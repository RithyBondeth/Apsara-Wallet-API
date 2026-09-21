import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { api, createApp } from './support/app';

const NIL = '00000000-0000-4000-8000-000000000000';

/**
 * Every protected route must 401 with no token and with a garbage token —
 * before validation, before lookup. Guards are attached per controller, so a
 * new controller that forgets @UseGuards(JwtAuthGuard) shows up here as a
 * 400/404 instead of a 401. Keep this list in step with the controllers.
 */
const PROTECTED: Array<['get' | 'post' | 'patch' | 'delete', string]> = [
  ['get', '/auth/me'],
  ['patch', '/auth/me'],
  ['post', '/auth/me/change-password'],
  ['delete', '/auth/me'],
  ['get', '/wallets'],
  ['get', '/wallets/summary'],
  ['get', `/wallets/${NIL}`],
  ['post', '/wallets'],
  ['patch', '/wallets/reorder'],
  ['patch', `/wallets/${NIL}`],
  ['delete', `/wallets/${NIL}`],
  ['get', '/transactions'],
  ['get', `/transactions/${NIL}`],
  ['post', '/transactions'],
  ['patch', `/transactions/${NIL}`],
  ['delete', `/transactions/${NIL}`],
  ['get', '/transfers'],
  ['post', '/transfers'],
  ['get', '/categories'],
  ['post', '/categories'],
  ['patch', `/categories/${NIL}`],
  ['delete', `/categories/${NIL}`],
  ['get', '/budgets'],
  ['post', '/budgets'],
  ['delete', `/budgets/${NIL}`],
  ['get', '/savings-goals'],
  ['post', '/savings-goals'],
  ['patch', `/savings-goals/${NIL}`],
  ['post', `/savings-goals/${NIL}/add-funds`],
  ['delete', `/savings-goals/${NIL}`],
  ['get', '/recurring'],
  ['post', '/recurring'],
  ['post', '/recurring/run'],
  ['patch', `/recurring/${NIL}`],
  ['delete', `/recurring/${NIL}`],
  ['get', '/notifications'],
  ['patch', `/notifications/${NIL}/read`],
  ['post', '/notifications/read-all'],
  ['post', '/notifications/insight'],
  ['post', '/notifications/devices'],
  ['delete', '/notifications/devices/some-token'],
  ['post', '/feedback'],
  ['get', '/feedback'],
];

/** Deliberately public. */
const PUBLIC: Array<['get' | 'post', string, number]> = [
  ['get', '/health', 200],
  ['get', '/fx/rates', 200],
  // Auth entry points: reachable, but reject an empty body with 400 not 401.
  ['post', '/auth/register', 400],
  ['post', '/auth/login', 400],
  ['post', '/auth/refresh', 400],
  ['post', '/auth/forgot-password', 400],
  ['post', '/auth/reset-password', 400],
  // Logout revokes by the refresh token in the body, so a client whose access
  // token has already expired can still sign out cleanly.
  ['post', '/auth/logout', 400],
];

describe('auth guard (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it.each(PROTECTED)('%s %s → 401 without a token', async (method, path) => {
    await api(app)[method](path).expect(401);
  });

  it.each(PROTECTED)(
    '%s %s → 401 with a garbage token',
    async (method, path) => {
      await api(app, 'not.a.jwt')[method](path).expect(401);
    },
  );

  it.each(PUBLIC)('%s %s is public (→ %i)', async (method, path, status) => {
    await api(app)[method](path).expect(status);
  });
});
