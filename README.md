<div align="center">

# Apsara Wallet — API

**The backend for Apsara Wallet, a personal finance app built for Cambodia with dual-currency (KHR/USD) support.**

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-C5F74F?style=for-the-badge&logo=drizzle&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=white)

</div>

---

## Overview

Apsara Wallet API is the NestJS backend for [Apsara Wallet](https://github.com/RithyBondeth/Apsara-Wallet-Mobile). It owns the ledger: wallets in KHR and USD, transactions and transfers, categories, budgets, savings goals, recurring rules, an in-app notification inbox, exchange rates, and JWT authentication with email password reset. All routes are served under `/api/v1`.

## Features

- **Multi-currency wallets** (KHR and USD) that can be reordered.
- **Ledger:** transactions and balance-safe wallet-to-wallet transfers.
- **Categories, budgets with alert thresholds, and savings goals** with an add-funds flow.
- **Recurring transactions** materialized by an hourly scheduler, with catch-up and a cap.
- **Notifications:** an in-app inbox with read state, device tokens, and Firebase Cloud Messaging push.
- **KHR/USD exchange rates.**
- **Authentication:** register, login, refresh, logout, profile, change password, password reset (Resend email), and account deletion.
- **Feedback** collection and health checks.
- **Hardening:** request validation, rate limiting, and per-user tenant isolation, all enforced by e2e tests.
- **Swagger docs** in development.

## Tech Stack

| Area | Technology |
| --- | --- |
| Framework | NestJS |
| Language | TypeScript |
| Database | PostgreSQL 16, Drizzle ORM |
| Authentication | JWT (access and refresh tokens) |
| Notifications | Firebase Cloud Messaging |
| Email | Resend |
| Testing | Jest (unit and e2e) |
| Deployment | Docker, Railway, GitHub Actions CI |

## Getting Started

### Prerequisites

- Node.js 20 or newer
- Docker, or any PostgreSQL 16 instance

### Installation

```bash
git clone https://github.com/RithyBondeth/Apsara-Wallet-API.git
cd Apsara-Wallet-API
cp .env.example .env      # the defaults work for local development
npm install
npm run docker:up         # PostgreSQL 16 on localhost:5432
npm run db:migrate
npm run db:seed           # optional demo user and sample ledger
npm run start:dev         # http://localhost:3010/api/v1
```

- Health check: `GET /api/v1/health`
- Swagger: `/docs` in development (set `SWAGGER_ENABLED=true` to enable it in production)

### Environment Variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Token-signing keys |
| `RECURRING_SCHEDULER_ENABLED` | Hourly recurring-transaction job (on by default) |
| `RESEND_API_KEY`, `RESEND_FROM`, `PASSWORD_RESET_URL` | Password-reset email |
| `FIREBASE_SERVICE_ACCOUNT` | Push notification delivery |
| `CORS_ORIGINS` | Allowed browser origins |

### Scripts

| Command | Description |
| --- | --- |
| `npm run start:dev` | Start in watch mode |
| `npm run db:generate` | Generate a migration from schema changes |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Open Drizzle Studio |
| `npm test` | Unit tests (no database needed) |
| `npm run test:e2e` | End-to-end HTTP tests against a live database |

## Project Structure

```text
Apsara-Wallet-API/
├── src/
│   ├── common/          # Decorators, enums, shared interfaces
│   ├── config/          # Environment validation
│   ├── database/        # Drizzle schema, migration runner, seeding
│   └── modules/
│       ├── auth/  wallets/  transactions/  transfers/  categories/
│       ├── budgets/  savings-goals/  recurring/  notifications/
│       └── fx/  feedback/  email/  health/
├── drizzle/             # SQL migrations
├── test/                # End-to-end suites
├── Dockerfile
└── docker-compose.yml
```

## Deployment

The API ships as a Docker image to Railway, and migrations run before every production boot. See [DEPLOYMENT.md](DEPLOYMENT.md) for setup and the required variables.

## Related Repositories

- [Apsara-Wallet-Mobile](https://github.com/RithyBondeth/Apsara-Wallet-Mobile): the Flutter mobile app
- [Apsara-Wallet-Web](https://github.com/RithyBondeth/Apsara-Wallet-Web): the marketing site and app-store compliance pages

## Author

**Rithy Bondeth** — Full Stack Developer & AI Engineer

[![Portfolio](https://img.shields.io/badge/Portfolio-0A0A0A?style=for-the-badge&logo=vercel&logoColor=white)](https://bondeth.dev)
[![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/RithyBondeth)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/rithy-bondeth-484073282/)
