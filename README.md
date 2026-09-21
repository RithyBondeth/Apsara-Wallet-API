# Apsara Wallet API

Backend for [Apsara Wallet](../Apsara-Wallet-Mobile), a personal finance app
for Cambodia. NestJS + Postgres (Drizzle ORM), served under `/api/v1`.

The API owns the ledger: wallets in KHR/USD, transactions and transfers,
categories, budgets, savings goals, recurring rules, an in-app notification
inbox, FX rates, and JWT auth with email password reset.

## Requirements

- Node 20+
- Docker (for the local Postgres) — or any Postgres 16 you can point
  `DATABASE_URL` at

## Run it locally

```bash
cp .env.example .env      # defaults work as-is for local dev
npm install
npm run docker:up         # Postgres 16 on localhost:5432
npm run db:migrate        # apply drizzle/ migrations
npm run db:seed           # optional: demo user + sample ledger
npm run start:dev         # http://localhost:3010/api/v1
```

The dev port is **3010**, not 3000 — the sibling Apsara Talent services own
3000/3001/3005 on a dev machine. The mobile app's `.env.dev` already points at
3010.

Health check: `GET /api/v1/health`. Swagger is at `/docs` in development
(set `SWAGGER_ENABLED=true` to expose it in production).

## Configuration

Everything is read from `.env`; `.env.example` documents every variable.
The ones you will actually touch:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Token signing keys — generate fresh ones for anything non-local |
| `RECURRING_SCHEDULER_ENABLED` | Hourly cron that materialises recurring transactions (default on) |
| `RESEND_API_KEY` / `RESEND_FROM` / `PASSWORD_RESET_URL` | Password-reset email. Unset → dev returns the reset token in the response instead |
| `FIREBASE_SERVICE_ACCOUNT` | FCM push delivery. Unset → push is skipped, the in-app inbox still works |
| `CORS_ORIGINS` | Browser origins allowed through CORS. Native clients never need this |

## Project layout

```
src/
├── main.ts              # bootstrap, global prefix, Swagger, validation pipe
├── app.module.ts
├── common/              # decorators, enums, shared interfaces
├── config/              # env validation
├── database/            # Drizzle schema, migrations runner, seeding/
└── modules/
    ├── auth/            # register, login, refresh, logout, /me, change/reset password
    ├── wallets/         # wallets + reorder
    ├── transactions/    # ledger entries
    ├── transfers/       # wallet-to-wallet moves (balance-safe)
    ├── categories/
    ├── budgets/
    ├── savings-goals/   # goals + add-funds
    ├── recurring/       # rules + the materialisation cron
    ├── notifications/   # inbox, read state, device tokens, FCM push
    ├── fx/              # KHR/USD rates
    ├── feedback/
    ├── email/           # Resend transport
    └── health/
```

Each module follows the same shape: `*.controller.ts` (thin, typed against an
`I*Controller` interface), `*.service.ts` (all business rules), `dtos/`.

## Database

Schema lives in `src/database/schema`; migrations in `drizzle/`.

```bash
npm run db:generate   # write a new migration from schema changes
npm run db:migrate    # apply pending migrations
npm run db:push       # dev only: sync schema without a migration
npm run db:studio     # Drizzle Studio
```

Migrations also run automatically before every production boot
(`npm run db:migrate:prod`), so a bad migration fails the health check
instead of serving traffic.

## Tests

```bash
npm run lint          # eslint --fix
npm test              # unit specs, no database needed
npm run test:e2e      # real HTTP suite against a live Postgres
```

Unit specs sit next to the code (`src/modules/**/*.spec.ts`) and run in
about a second. They drive the services against `test/support/fake-db.ts`,
a recording stand-in for the Drizzle handle: tests queue what each query
returns and then assert on the real bound SQL parameters — which wallet an
update targeted, by what signed amount, whether it ran inside a transaction.
This is where the ledger invariants live (balance moves on create / update /
delete / transfer, budget-alert crossing, recurring catch-up and its cap).

The e2e suite (`test/*.e2e-spec.ts`) boots the app and exercises, over real
HTTP: auth; the ledger invariants (transfers, deletes, budgets, recurring,
goals, notifications); throttling; **tenant isolation** (everything user A
owns is 404 / rejected for user B — the guard is per controller, so a new
endpoint that forgets the user scope fails here); the **auth guard sweep**
(every protected route 401s without a token — add new routes to the list in
`auth-guard.e2e-spec.ts`); and **request validation** (the DTO rules and the
whitelist/forbid-unknown pipe). It needs `DATABASE_URL` pointing at a migrated, seeded database — the
local `docker:up` + `db:migrate` + `db:seed` sequence above is enough.

CI (`.github/workflows/ci.yml`) runs lint with zero warnings and the unit
specs first, then builds, migrates and seeds a fresh Postgres, boot-smokes
`dist/main`, and runs the e2e suite.

## Deployment

Ships as a Docker image to Railway; see [DEPLOYMENT.md](DEPLOYMENT.md) for
the one-time project setup, required variables and secret generation.

## Related

- [Apsara-Wallet-Mobile](../Apsara-Wallet-Mobile) — the Flutter app
- [Apsara-Wallet-Web](../Apsara-Wallet-Web) — marketing site and the store
  compliance pages (`/privacy`, `/terms`, `/delete-account`, `/support`)
