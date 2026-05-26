# CoreERP API

NestJS backend for a multi-tenant ERP order-to-cash MVP. The system models a
realistic internal back-office flow for Vietnamese SMBs: master data, inventory,
sales orders, fulfillment, invoices, payments, and audit logs.

```text
Sales Order -> Stock Reservation -> Fulfillment -> Invoice -> Payment -> Completion
```

## Highlights

- Multi-tenant data model for users, master data, inventory, orders, invoices,
  payments, and audit logs.
- JWT authentication with role-based access control.
- PostgreSQL-backed inventory reservation with transactions and row-level
  locking to prevent overselling.
- Invoice snapshots and partial/full payment rules for stable financial history.
- Swagger-documented REST APIs with E2E coverage for the core business flow.
- GitHub Actions CI for lint, build, Prisma validation, migrations, and tests.

## Tech Stack

- Node.js, TypeScript, NestJS
- PostgreSQL, Prisma, Docker Compose
- JWT, Passport, bcrypt
- Swagger/OpenAPI
- Jest, Supertest

## Modules

- Auth and current user
- Tenant users and RBAC
- Customers, products, warehouses
- Inventory and stock movements
- Sales orders and reservations
- Invoices and payments
- Audit logs
- Health check

## Quick Start

Install dependencies:

```bash
npm install
```

Create the environment file:

```bash
cp .env.example .env
```

Start PostgreSQL:

```bash
docker compose up -d
```

Prepare the database:

```bash
npm run prisma:migrate
npm run prisma:generate
npm run db:seed
```

Start the API:

```bash
npm run start:dev
```

On Windows PowerShell, use `npm.cmd` if the `npm.ps1` wrapper is blocked by
script execution policy.

## Local Services

| Service | URL |
| --- | --- |
| API | `http://localhost:3000` |
| Swagger | `http://localhost:3000/api/docs` |
| Health | `http://localhost:3000/api/v1/health` |
| React admin | `http://localhost:5173` |

The React admin lives in the separate `coreerp-admin` repository. Configure
allowed frontend origins with `FRONTEND_ORIGIN`, for example:

```text
FRONTEND_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
```

## Demo Accounts

All seeded demo accounts use password `123456`.

| Tenant | Email | Role |
| --- | --- | --- |
| `minh-anh-retail` | `admin@minhanh.vn` | `TENANT_ADMIN` |
| `minh-anh-retail` | `sales@minhanh.vn` | `SALES` |
| `minh-anh-retail` | `warehouse@minhanh.vn` | `WAREHOUSE` |
| `minh-anh-retail` | `finance@minhanh.vn` | `FINANCE` |
| `minh-anh-retail` | `viewer@minhanh.vn` | `VIEWER` |
| `hoang-long-fashion` | `admin@hoanglong.vn` | `TENANT_ADMIN` |
| `hoang-long-fashion` | `sales@hoanglong.vn` | `SALES` |
| `hoang-long-fashion` | `warehouse@hoanglong.vn` | `WAREHOUSE` |
| `hoang-long-fashion` | `finance@hoanglong.vn` | `FINANCE` |
| `hoang-long-fashion` | `viewer@hoanglong.vn` | `VIEWER` |

## Verification

```bash
npm run lint
npm run build
npm run prisma:validate
npm test -- --runInBand
```

E2E tests cover the order-to-cash flow, tenant isolation, RBAC restrictions,
overselling prevention, reservation release, invoice snapshots, payment rules,
and audit logging.

## Documentation

- [CoreERP Documentation](docs/coreerp-documentation.md)
- [Demo Guide](docs/demo-guide.md)

## Scope

This MVP is an internal ERP/back-office system, not an e-commerce checkout,
payment gateway, legal e-invoice platform, microservices system, or 3PL
warehouse platform.

Current limitations:

- No production deployment pipeline is configured.
- No public tenant signup; demo tenants are seeded.
- One user belongs to one tenant.
- One sales order uses one logical warehouse.
- Reports, printable invoices, PDF export, legal e-invoice integration,
  provider webhooks, refunds, and reconciliation are not implemented.
- Redis, Kafka, Redpanda, and Outbox workflows are intentionally outside the
  MVP scope.
- Composite tenant-scoped database FK hardening is deferred; service-level
  checks and E2E tests cover tenant isolation.
