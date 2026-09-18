import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { api, createApp, deleteUser, registerUser } from './support/app';

describe('auth (e2e)', () => {
  let app: INestApplication<App>;
  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(() => app.close());

  it('registers, rejects duplicates and weak passwords', async () => {
    const u = await registerUser(app);
    await api(app)
      .post('/auth/register', {
        email: u.email,
        password: u.password,
        fullName: 'X',
      })
      .expect(409);
    await api(app)
      .post('/auth/register', {
        email: `a${u.email}`,
        password: 'short',
        fullName: 'X',
      })
      .expect(400);
    await deleteUser(app, u.accessToken, u.password);
  });

  it('rotates refresh tokens and rejects reuse', async () => {
    const u = await registerUser(app);
    const r1 = await api(app)
      .post('/auth/refresh', { refreshToken: u.refreshToken })
      .expect(200);
    expect(r1.body.accessToken).toBeDefined();
    await api(app)
      .post('/auth/refresh', { refreshToken: u.refreshToken })
      .expect(401);
    await deleteUser(app, r1.body.accessToken, u.password);
  });

  it('requires a bearer on protected routes and whitelists body fields', async () => {
    const u = await registerUser(app);
    await api(app).get('/wallets').expect(401);
    await api(app, u.accessToken)
      .patch('/auth/me', { email: 'hack@x.com' })
      .expect(400);
    const me = await api(app, u.accessToken)
      .patch('/auth/me', { phone: '+85512345678' })
      .expect(200);
    expect(me.body.phone).toBe('+85512345678');
    await deleteUser(app, u.accessToken, u.password);
  });

  it('forgot/reset password revokes sessions; login works with the new password', async () => {
    const u = await registerUser(app);
    const fp = await api(app)
      .post('/auth/forgot-password', { email: u.email })
      .expect(200);
    // Dev/test mode returns the token instead of emailing it.
    expect(fp.body.resetToken).toBeDefined();
    await api(app)
      .post('/auth/reset-password', {
        token: fp.body.resetToken,
        newPassword: 'N3wStrongPass!',
      })
      .expect(200);
    await api(app)
      .post('/auth/refresh', { refreshToken: u.refreshToken })
      .expect(401);
    await api(app)
      .post('/auth/login', { email: u.email, password: u.password })
      .expect(401);
    const login = await api(app)
      .post('/auth/login', { email: u.email, password: 'N3wStrongPass!' })
      .expect(200);
    await deleteUser(app, login.body.accessToken, 'N3wStrongPass!');
  });

  it('changes the password when signed in and revokes other sessions', async () => {
    const u = await registerUser(app);
    const t = u.accessToken;
    await api(app, t)
      .post('/auth/me/change-password', {
        currentPassword: 'wrong',
        newPassword: 'N3wStrongPass!',
      })
      .expect(401);
    await api(app, t)
      .post('/auth/me/change-password', {
        currentPassword: u.password,
        newPassword: u.password,
      })
      .expect(400);
    await api(app, t)
      .post('/auth/me/change-password', {
        currentPassword: u.password,
        newPassword: 'N3wStrongPass!',
      })
      .expect(200);
    await api(app)
      .post('/auth/refresh', { refreshToken: u.refreshToken })
      .expect(401);
    await api(app)
      .post('/auth/login', { email: u.email, password: 'N3wStrongPass!' })
      .expect(200);
    await deleteUser(app, t, 'N3wStrongPass!');
  });

  it('deletes the account only with the right password, then the token is dead', async () => {
    const u = await registerUser(app);
    await api(app, u.accessToken)
      .delete('/auth/me', { password: 'wrong' })
      .expect(401);
    await deleteUser(app, u.accessToken, u.password);
    await api(app, u.accessToken).get('/auth/me').expect(401);
    await api(app)
      .post('/auth/login', { email: u.email, password: u.password })
      .expect(401);
  });
});
