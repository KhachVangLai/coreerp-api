# CoreERP API

SaaS-ready multi-tenant ERP backend for Vietnamese SMBs, built with NestJS, PostgreSQL, Prisma, JWT/RBAC, Swagger, and Jest.

CoreERP is an internal ERP admin / back-office backend for a SaaS-ready multi-tenant ERP admin dashboard. The MVP is focused on Order-to-Cash, not e-commerce checkout, payment gateway processing, legal e-invoice compliance, microservices, or 3PL warehouse operations.

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
- [Future Improvements](#future-improvements)
- [Technical Debt](#technical-debt)
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

Local React admin frontend:

- Frontend dev server: `http://localhost:5173`
- Backend API: `http://localhost:3000`
- CORS origins are configured with `FRONTEND_ORIGIN` in `.env`.
- Multiple local origins can be comma-separated, for example `http://localhost:5173,http://127.0.0.1:5173`.

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

- The separate React admin frontend is available in `coreerp-admin`; Swagger remains the API reference.
- Demo tenants are seeded; no public tenant signup yet.
- One user belongs to one tenant in the MVP.
- Warehouse is a tenant-scoped logical warehouse in the MVP.
- One order uses one warehouse in the MVP.
- No Redis, Kafka, Redpanda, or Outbox in the MVP.
- No reports module in the MVP.
- No production deployment or CI/CD yet.
- No online payment gateway, payment links, provider webhooks, refunds, or reconciliation.
- No printable invoice view, invoice PDF export, legal e-invoice integration, digital signature, or email sending.
- DB-level composite tenant-scoped FK hardening is deferred; service-level tenant checks and E2E tests are implemented.

## MVP Positioning

- PostgreSQL is the source of truth for business state.
- Inventory correctness uses PostgreSQL transactions and row-level locking.
- Redis/Valkey is intentionally not used in the MVP. It may be considered later only for non-critical caching or rate limiting if a measured need appears.
- Redis/Valkey must not be used for inventory correctness, payment state, order state, invoice state, or audit logs.
- Payments are manual finance-user payment records with partial/full payment, overpayment prevention, invoice status updates, and sales order completion when fulfilled and fully paid.
- Invoices are data records with issue workflow, invoice line snapshots, and payment tracking. They are not PDF documents or legal e-invoices in the MVP.

## Future Improvements

- Printable invoice view / PDF export.
- GitHub Actions CI for lint, build, and test.
- Frontend E2E tests with Playwright.
- Reports/read models for revenue, unpaid invoices, and low stock.
- Composite tenant-scoped database FK hardening.
- Platform tenant onboarding.
- Deployment guide.
- Optional payment gateway adapter and webhook simulation if a customer-facing payment flow is added.
- Optional e-invoice provider abstraction if legal invoice integration is needed.
- Optional Outbox pattern with Kafka/Redpanda if async integration or service split becomes necessary.
- Optional Redis/Valkey for non-critical caching or rate limiting after measured need.

## Technical Debt

- DB-level composite tenant-scoped FK hardening is deferred.
- Prisma seed configuration currently lives in `package.json#prisma`; Prisma warns this will change in Prisma 7.
- CI/CD is not implemented yet.
- Deployment is not implemented yet.

## CV Bullets

- Built a multi-tenant ERP backend with JWT/RBAC, tenant-scoped isolation, and Swagger-documented REST APIs.
- Implemented transactional stock reservation with PostgreSQL row-level locking to prevent overselling.
- Designed invoice snapshot and payment workflow with partial/full payment and order completion.
- Added audit logging and E2E tests covering Order-to-Cash, RBAC, tenant isolation, and inventory/payment edge cases.
