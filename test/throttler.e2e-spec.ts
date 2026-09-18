import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { api, createApp } from './support/app';

/** Keeps the real ThrottlerGuard to prove the credential endpoints rate-limit. */
describe('throttling (e2e)', () => {
  let app: INestApplication<App>;
  beforeAll(async () => {
    app = await createApp({ throttle: true });
  });
  afterAll(() => app.close());

  it('forgot-password allows 3/min then returns 429', async () => {
    const body = { email: `nobody-${Date.now()}@test.local` };
    for (let i = 0; i < 3; i++) {
      await api(app).post('/auth/forgot-password', body).expect(200);
    }
    await api(app).post('/auth/forgot-password', body).expect(429);
  });
});
