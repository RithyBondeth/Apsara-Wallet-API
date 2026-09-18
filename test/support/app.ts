import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';

/**
 * Boots the real AppModule against DATABASE_URL (the local docker Postgres,
 * or the CI service) with the same global pipes/prefix as main.ts, so the
 * tests exercise exactly what a client sees. The throttler guard is replaced
 * by default — a suite that logs in a dozen times would otherwise trip the
 * 10/min login limit; `throttler.e2e-spec.ts` keeps the real one.
 */
export async function createApp(opts: { throttle?: boolean } = {}) {
  let builder = Test.createTestingModule({ imports: [AppModule] });
  if (!opts.throttle) {
    builder = builder
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true });
  }
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.init();
  return app;
}

/** A fresh, unique test account so specs never collide or depend on order. */
export async function registerUser(app: INestApplication<App>) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;
  const password = 'Str0ngPass!';
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send({ email, password, fullName: 'E2E Tester' })
    .expect(201);
  return {
    email,
    password,
    accessToken: res.body.accessToken as string,
    refreshToken: res.body.refreshToken as string,
  };
}

/** Bound request helpers carrying the bearer token. */
export function api(app: INestApplication<App>, token?: string) {
  const auth = (r: request.Test) =>
    token ? r.set('Authorization', `Bearer ${token}`) : r;
  const s = () => request(app.getHttpServer());
  return {
    get: (p: string) => auth(s().get(`/api/v1${p}`)),
    post: (p: string, body?: object) =>
      auth(s().post(`/api/v1${p}`).send(body)),
    patch: (p: string, body?: object) =>
      auth(s().patch(`/api/v1${p}`).send(body)),
    delete: (p: string, body?: object) =>
      auth(s().delete(`/api/v1${p}`).send(body)),
  };
}

/** Deletes the account (cascades every row it owns) so the DB stays clean. */
export async function deleteUser(
  app: INestApplication<App>,
  token: string,
  password: string,
) {
  await api(app, token).delete('/auth/me', { password }).expect(200);
}

/** Resolves system category ids by slug from GET /categories. */
export async function categoryIds(app: INestApplication<App>, token: string) {
  const res = await api(app, token).get('/categories').expect(200);
  const flat: Array<{ id: string; slug: string }> = Array.isArray(res.body)
    ? res.body
    : Object.values(res.body).flat();
  return Object.fromEntries(flat.map((c) => [c.slug, c.id])) as Record<
    string,
    string
  >;
}
