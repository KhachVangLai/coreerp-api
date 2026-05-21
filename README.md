# CoreERP API

SaaS-ready multi-tenant ERP backend for Vietnamese SMBs, built with NestJS, PostgreSQL, Prisma, JWT/RBAC, Swagger, and Jest.

The MVP implements the Order-to-Cash workflow:

```text
Sales Order -> Stock Reservation -> Warehouse Fulfillment -> Invoice Snapshot -> Payment -> Order Completion
```

## Table Of Contents

- [Highlights](#highlights)
- [Tech Stack](#tech-stack)
- [MVP Modules](#mvp-modules)
- [Quick Start](#quick-start)
- [Demo Accounts](#demo-accounts)
- [API Docs](#api-docs)
- [Testing](#testing)
- [Documentation](#documentation)
- [Known Limits](#known-limits)
- [CV Bullets](#cv-bullets)

## Highlights

- Modular monolith backend for a realistic ERP MVP.
- Tenant-scoped data isolation for users, master data, inventory, orders, invoices, payments, and audit logs.
- JWT authentication with RBAC guards.
- Transactional stock reservation with PostgreSQL row-level locking to prevent overselling.
- Invoice line snapshots so historical financial documents remain stable.
- Partial/full payment workflow that completes fulfilled sales orders.
- Audit logs for key business actions.
- Swagger-documented REST APIs and E2E tests for the full business flow.

## Tech Stack

- Node.js + TypeScript
- NestJS
- PostgreSQL
- Prisma
- Docker Compose
- JWT + Passport
- RBAC
- Swagger/OpenAPI
- Jest + Supertest
- bcrypt

## MVP Modules

- Auth and current user
- RBAC helpers
- Tenant users
- Customers
- Products
- Warehouses
- Inventory
- Sales orders
- Invoices
- Payments
- Audit logs
- Health check

## Quick Start

Install dependencies:

```bash
npm install
```

Create `.env`:

```bash
cp .env.example .env
```

Start PostgreSQL:

```bash
docker compose up -d
```

Run Prisma migration, generate client, and seed demo accounts:

```bash
npm run prisma:migrate
npm run prisma:generate
npm run db:seed
```

Start the API:

```bash
npm run start:dev
```

On Windows PowerShell, use `npm.cmd` if `npm` is blocked by script execution policy.

## Demo Accounts

All demo accounts use password `123456`.

| tenantCode | email | role |
|---|---|---|
| minh-anh-retail | admin@minhanh.vn | TENANT_ADMIN |
| minh-anh-retail | sales@minhanh.vn | SALES |
| minh-anh-retail | warehouse@minhanh.vn | WAREHOUSE |
| minh-anh-retail | finance@minhanh.vn | FINANCE |
| minh-anh-retail | viewer@minhanh.vn | VIEWER |
| hoang-long-fashion | admin@hoanglong.vn | TENANT_ADMIN |
| hoang-long-fashion | sales@hoanglong.vn | SALES |
| hoang-long-fashion | warehouse@hoanglong.vn | WAREHOUSE |
| hoang-long-fashion | finance@hoanglong.vn | FINANCE |
| hoang-long-fashion | viewer@hoanglong.vn | VIEWER |

## API Docs

Swagger UI:

```text
http://localhost:3000/api/docs
```

Health check:

```text
GET http://localhost:3000/api/v1/health
```

## Testing

Recommended verification:

```bash
npm run build
npm run lint
npm test -- --runInBand
npm run prisma:validate
```

E2E tests cover:

- Full Order-to-Cash flow.
- Tenant isolation.
- RBAC restrictions.
- Overselling prevention.
- Cancel/release reservation.
- Invoice snapshots.
- Payment rules.
- Audit logs.

## Documentation

- [CoreERP Documentation](docs/coreerp-documentation.md)
- [Demo Guide](docs/demo-guide.md)

## Known Limits

- No frontend yet; Swagger is used for API demo.
- Demo tenants are seeded; no public tenant signup yet.
- One user belongs to one tenant in the MVP.
- One order uses one warehouse in the MVP.
- No reports, Redis, Kafka, Outbox, refunds, returns, deployment guide, or CI/CD yet.
- DB-level composite tenant-scoped FK hardening is deferred; service-level tenant checks and E2E tests are implemented.

## CV Bullets

- Built a multi-tenant ERP backend with JWT/RBAC, tenant-scoped isolation, and Swagger-documented REST APIs.
- Implemented transactional stock reservation with PostgreSQL row-level locking to prevent overselling.
- Designed invoice snapshot and payment workflow with partial/full payment and order completion.
- Added audit logging and E2E tests covering Order-to-Cash, RBAC, tenant isolation, and inventory/payment edge cases.
