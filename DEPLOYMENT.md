# Deploying the Apsara Wallet API to Railway

The service ships as a Docker image (`Dockerfile`) and Railway is configured
through `railway.json`. Migrations run automatically before each boot, so a
deploy with a bad schema fails the health check instead of serving traffic.

## One-time setup

1. **Create the project and database**

   In the Railway dashboard: *New Project* → *Deploy from GitHub repo* →
   `RithyBondeth/Apsara-Wallet-API`. Then *New* → *Database* → *Add PostgreSQL*
   in the same project, so both share the private network.

2. **Point the API at Postgres**

   On the API service, add a variable referencing the database service:

   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   ```

   Railway resolves this to the private-network URL
   (`postgres.railway.internal`), which needs no TLS — leave `DATABASE_SSL`
   unset. If you ever connect over the public proxy host instead, set
   `DATABASE_SSL=true`.

3. **Set the remaining variables**

   ```
   NODE_ENV=production
   JWT_ACCESS_SECRET=<64 random hex chars — see below>
   JWT_REFRESH_SECRET=<a different 64 random hex chars>
   JWT_ACCESS_TTL=15m
   JWT_REFRESH_TTL=30d
   ```

   Generate each secret separately and never reuse the dev values:

   ```bash
   openssl rand -hex 32
   ```

   `PORT` is injected by Railway — do not set it. Optional extras
   (`RESEND_API_KEY`, `FIREBASE_SERVICE_ACCOUNT`, `CORS_ORIGINS`,
   `SWAGGER_ENABLED`) are documented in `.env.example`.

4. **Generate the public domain**

   API service → *Settings* → *Networking* → *Generate Domain*. You get
   something like `apsara-wallet-api-production.up.railway.app`.

5. **Point the mobile app at it**

   In the mobile repo, set `API_BASE_URL` in `.env.staging` to
   `https://<your-domain>/api/v1`. See that repo's `RELEASE.md`.

## Verifying a deploy

```bash
curl https://<your-domain>/api/v1/health
```

Expect `{"status":"ok","uptime":<seconds>}`. A 503 means the app is up but
cannot reach Postgres — check `DATABASE_URL`.

## Notes

- **Migrations** run as a separate process in the container's `CMD`
  (`node dist/database/migrate.js && node dist/main`). Drizzle's migrator takes
  a Postgres advisory lock, so scaling to multiple instances is safe.
- **Seeding** is not run automatically. To seed the default categories against
  the deployed database, run `npm run db:seed` locally with `DATABASE_URL`
  pointing at Railway's *public* proxy URL.
- **The recurring-entry cron** (`RECURRING_SCHEDULER_ENABLED`, default on) is
  also advisory-locked and safe to leave enabled on every instance.
