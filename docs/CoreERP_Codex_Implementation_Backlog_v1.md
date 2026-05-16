# CoreERP - Codex Implementation Backlog v1

Status: Implementation handoff plan
Purpose: Break CoreERP MVP into Codex-friendly tasks with clear acceptance criteria.

## 0. Ground rules for Codex

Codex must follow these rules:

- Do not change business flow unless explicitly requested.
- Do not add microservices, Kafka, Redis, refresh tokens, frontend, or reports in MVP unless a task asks for it.
- Do not trust `tenantId` from request body.
- Always scope business queries by `currentUser.tenantId`.
- Use Prisma for normal CRUD.
- Use PostgreSQL transaction plus row-level lock / raw SQL for inventory reservation, release, and fulfillment.
- Keep the app modular monolith.
- Use Swagger decorators for public API documentation.
- Use Jest tests for business-critical flows.

## 1. Recommended task order

1. Initialize NestJS foundation
2. Setup Prisma + PostgreSQL + Docker Compose
3. Add Prisma schema + migration + seed data
4. Add common API conventions
5. Implement Auth + JWT + current user
6. Implement RBAC + Tenant isolation helpers
7. Implement User management
8. Implement Master Data modules
9. Implement Inventory receive/adjust/stock movement
10. Implement Sales Order create/list/detail
11. Implement Confirm Order + stock reservation transaction
12. Implement Cancel Order + release reservation
13. Implement Fulfill Order + commit stock OUT
14. Implement Invoice generation + issue
15. Implement Payment recording + order completion
16. Implement AuditLog integration
17. Add e2e tests for core flow
18. Polish README, Swagger, demo seed and Postman/HTTP examples

---

## Task 01 - Initialize NestJS project

Goal:

Create the base NestJS application with TypeScript strict mode and clean project structure.

Expected work:

- Create NestJS project.
- Enable TypeScript strict mode.
- Add ConfigModule.
- Add `/api/v1` global prefix.
- Add global ValidationPipe.
- Add global exception filter placeholder.
- Add Swagger setup.
- Add HealthModule.

Files/modules:

- `src/main.ts`
- `src/app.module.ts`
- `src/health/health.module.ts`
- `src/health/health.controller.ts`
- `src/common/filters/http-exception.filter.ts`

Acceptance criteria:

- `GET /api/v1/health` returns `{ data: { status: "ok", service: "coreerp-api" } }`.
- Swagger is available at `/api/docs` or `/docs`.
- ValidationPipe rejects invalid payloads.

---

## Task 02 - Setup PostgreSQL, Prisma, and Docker Compose

Goal:

Prepare local database and Prisma integration.

Expected work:

- Add `docker-compose.yml` with PostgreSQL.
- Install `prisma` and `@prisma/client`.
- Add `prisma/schema.prisma` from `CoreERP_Prismeschema_v1.prisma`.
- Add PrismaService and PrismaModule.
- Add `.env.example`.

Files/modules:

- `docker-compose.yml`
- `.env.example`
- `prisma/schema.prisma`
- `src/prisma/prisma.module.ts`
- `src/prisma/prisma.service.ts`

Acceptance criteria:

- `docker compose up -d postgres` works.
- `npx prisma migrate dev --name init` works.
- `npx prisma generate` works.
- NestJS can connect to PostgreSQL.

---

## Task 03 - Seed demo tenants and users

Goal:

Create demo tenants and users for multi-tenant testing.

Seed data:

Tenant 1:

- code: `minh-anh-retail`
- users: admin, sales, warehouse, finance, viewer

Tenant 2:

- code: `hoang-long-fashion`
- users: admin, sales, warehouse, finance, viewer

Expected work:

- Add `prisma/seed.ts`.
- Hash passwords using bcrypt or argon2.
- Seed products, warehouses, customers, and initial stock for both tenants.

Acceptance criteria:

- Login is possible for both tenants after Auth task is done.
- Same SKU can exist in both tenants.
- Same email can exist in different tenants if tenantCode differs.

---

## Task 04 - Common API response and error conventions

Goal:

Standardize responses and business errors.

Expected work:

- Create response helper/interceptor if needed.
- Create AppException or BusinessException class.
- Standardize error response:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```

Acceptance criteria:

- Validation errors return consistent format.
- Business errors return correct HTTP status and error code.

---

## Task 05 - Auth login and current user

Goal:

Implement tenantCode + email + password login.

Endpoints:

- `POST /api/v1/auth/login`
- `GET /api/v1/me`

Expected work:

- Validate tenant by `tenantCode`.
- Validate user by `tenantId + email`.
- Check password hash.
- Reject suspended tenant or inactive user.
- Issue JWT with `userId`, `tenantId`, `role`.
- Add JwtAuthGuard and CurrentUser decorator.

Acceptance criteria:

- Valid user can login.
- Wrong tenant/email/password returns 401 INVALID_CREDENTIALS.
- `/me` returns current user and tenant context.

---

## Task 06 - RBAC and tenant guard helpers

Goal:

Implement role-based access control and tenant-scoped query helpers.

Expected work:

- Add `@Roles(...)` decorator.
- Add RolesGuard.
- Add CurrentUser type.
- Add helper methods for tenant-scoped lookup.

Acceptance criteria:

- SALES cannot call user creation.
- WAREHOUSE cannot issue invoice.
- FINANCE cannot fulfill order.
- VIEWER cannot mutate data.

---

## Task 07 - User management module

Goal:

Allow TENANT_ADMIN to manage tenant users.

Endpoints:

- `POST /api/v1/users`
- `GET /api/v1/users`
- `PATCH /api/v1/users/:id`

Business rules:

- TENANT_ADMIN can manage users only in current tenant.
- Client cannot send tenantId.
- Email unique in tenant.
- Cannot create platform admin.

Acceptance criteria:

- Admin creates SALES/WAREHOUSE/FINANCE/VIEWER users.
- Duplicate email in same tenant returns 409.
- Same email in different tenant is allowed.

---

## Task 08 - Master Data modules

Goal:

Implement Customer, Product, and Warehouse modules.

Endpoints:

Customers:

- `POST /api/v1/customers`
- `GET /api/v1/customers`
- `GET /api/v1/customers/:id`
- `PATCH /api/v1/customers/:id`

Products:

- `POST /api/v1/products`
- `GET /api/v1/products`
- `GET /api/v1/products/:id`
- `PATCH /api/v1/products/:id`

Warehouses:

- `POST /api/v1/warehouses`
- `GET /api/v1/warehouses`
- `GET /api/v1/warehouses/:id`
- `PATCH /api/v1/warehouses/:id`

Acceptance criteria:

- Tenant isolation works for all master data.
- Product SKU unique in tenant.
- Customer code unique in tenant.
- Warehouse code unique in tenant.
- Pagination works.

---

## Task 09 - Inventory receive, adjust, and movement ledger

Goal:

Implement stock receiving, adjustment, stock item list, and movement ledger.

Endpoints:

- `GET /api/v1/inventory/stock-items`
- `POST /api/v1/inventory/receipts`
- `POST /api/v1/inventory/adjustments`
- `GET /api/v1/inventory/movements`

Business rules:

- Receive stock increases quantityOnHand.
- Adjust stock sets quantityOnHand to recount value.
- Adjustment cannot make quantityOnHand lower than quantityReserved.
- Every change creates StockMovement.

Acceptance criteria:

- Receive stock creates StockItem if missing.
- StockItem returns availableQuantity = onHand - reserved.
- Movement ledger is append-only from API perspective.

---

## Task 10 - Sales Order create/list/detail

Goal:

Implement sales order draft creation and query endpoints.

Endpoints:

- `POST /api/v1/sales-orders`
- `GET /api/v1/sales-orders`
- `GET /api/v1/sales-orders/:id`

Business rules:

- Order starts as DRAFT.
- Creating order does not reserve stock.
- Product snapshot is copied to SalesOrderLine.
- Total amount is calculated by backend.

Acceptance criteria:

- Order lines cannot be empty.
- Customer/warehouse/product must belong to current tenant.
- Changing product name/price after order creation does not change order line snapshot.

---

## Task 11 - Confirm order and reserve stock transaction

Goal:

Implement the most important backend logic: order confirmation with inventory reservation.

Endpoint:

- `PATCH /api/v1/sales-orders/:id/confirm`

Business rules:

- Only DRAFT order can be confirmed.
- For every order line, lock StockItem row using PostgreSQL row-level lock.
- Check availableQuantity.
- If any line lacks stock, rollback all changes.
- Increase quantityReserved.
- Create StockReservation per order line.
- Create StockMovement type RESERVE.
- Set SalesOrder status CONFIRMED.

Acceptance criteria:

- Confirming with enough stock succeeds.
- Confirming with insufficient stock fails with 409 INSUFFICIENT_STOCK.
- Failure rolls back all previous line changes.
- quantityOnHand does not decrease on confirm.
- quantityReserved increases.

Implementation note:

Use Prisma transaction plus raw SQL where needed for `SELECT ... FOR UPDATE`.

---

## Task 12 - Cancel order and release reservation

Goal:

Allow cancellation of DRAFT or CONFIRMED orders.

Endpoint:

- `PATCH /api/v1/sales-orders/:id/cancel`

Business rules:

- DRAFT can be cancelled directly.
- CONFIRMED releases stock reservation.
- FULFILLED and COMPLETED cannot be cancelled in MVP.

Acceptance criteria:

- Cancel confirmed order decreases quantityReserved.
- Reservation status becomes RELEASED.
- StockMovement RELEASE is created.
- Order status becomes CANCELLED.

---

## Task 13 - Fulfill order and commit stock OUT

Goal:

Implement warehouse fulfillment.

Endpoint:

- `PATCH /api/v1/sales-orders/:id/fulfill`

Business rules:

- Only CONFIRMED order can be fulfilled.
- Reservations must be RESERVED.
- Lock StockItem rows.
- Decrease quantityOnHand.
- Decrease quantityReserved.
- Reservation status becomes COMMITTED.
- Create StockMovement OUT.
- SalesOrder status becomes FULFILLED.

Acceptance criteria:

- SALES cannot fulfill.
- WAREHOUSE can fulfill.
- onHand and reserved are both reduced correctly.
- Order becomes FULFILLED.

---

## Task 14 - Invoice generation and issue

Goal:

Implement invoice snapshot workflow.

Endpoints:

- `POST /api/v1/invoices/from-sales-order/:salesOrderId`
- `GET /api/v1/invoices`
- `GET /api/v1/invoices/:id`
- `PATCH /api/v1/invoices/:id/issue`

Business rules:

- Invoice can be generated only after SalesOrder is FULFILLED.
- One order has at most one invoice in MVP.
- InvoiceLine snapshot is copied from SalesOrderLine.
- Invoice does not affect inventory.
- Only DRAFT invoice can be issued.

Acceptance criteria:

- FINANCE can generate invoice from FULFILLED order.
- Generating invoice twice fails with INVOICE_ALREADY_EXISTS.
- Product update after invoice generation does not change InvoiceLine snapshot.

---

## Task 15 - Payment and order completion

Goal:

Implement payment recording and automatic order completion.

Endpoints:

- `POST /api/v1/invoices/:id/payments`
- `GET /api/v1/payments`

Business rules:

- Invoice must be ISSUED or PARTIALLY_PAID.
- Amount must be positive.
- Total paid cannot exceed total amount.
- Partial payment sets invoice PARTIALLY_PAID.
- Full payment sets invoice PAID.
- If invoice becomes PAID and order is FULFILLED, set order COMPLETED.

Acceptance criteria:

- Partial payment works.
- Full payment works.
- Overpayment fails.
- DRAFT invoice cannot receive payment.
- Order completes after full payment.

---

## Task 16 - Audit log integration

Goal:

Add audit logs for important actions.

Actions:

- USER_CREATED
- PRODUCT_CREATED
- WAREHOUSE_CREATED
- STOCK_RECEIVED
- STOCK_ADJUSTED
- SALES_ORDER_CREATED
- SALES_ORDER_CONFIRMED
- SALES_ORDER_CANCELLED
- SALES_ORDER_FULFILLED
- INVOICE_GENERATED
- INVOICE_ISSUED
- PAYMENT_RECORDED
- SALES_ORDER_COMPLETED

Endpoint:

- `GET /api/v1/audit-logs`

Acceptance criteria:

- TENANT_ADMIN can view audit logs in current tenant only.
- Logs include actorUserId, action, entityType, entityId, metadata, createdAt.

---

## Task 17 - E2E tests for core flow

Goal:

Protect the ERP business flow with automated tests.

Required tests:

1. Tenant A cannot see Tenant B products.
2. Same SKU can exist in two tenants.
3. Duplicate SKU in same tenant fails.
4. Receive stock increases onHand.
5. Confirm order increases reserved, not onHand.
6. Confirm fails when stock insufficient.
7. Cancel confirmed order releases reserved stock.
8. Fulfill confirmed order decreases onHand and reserved.
9. Generate invoice after fulfillment creates snapshot.
10. Product update does not alter old invoice snapshot.
11. Partial payment sets PARTIALLY_PAID.
12. Full payment sets PAID.
13. Order becomes COMPLETED only when fulfilled and paid.

Acceptance criteria:

- Tests run with `npm test` or `npm run test:e2e`.
- Test data is isolated.

---

## Task 18 - README and demo guide

Goal:

Make the project presentable for CV/interview.

Expected README sections:

- Project overview
- Why CoreERP is not just CRUD
- Tech stack
- Architecture decision: modular monolith
- Multi-tenant model
- Role-based workflow
- Inventory transaction design
- Invoice snapshot design
- How to run locally
- Demo accounts
- API demo flow
- Test command
- Future improvements

Acceptance criteria:

- A reviewer can run the project locally using README.
- Demo flow is clear without frontend.
- Swagger screenshots or API examples are included.

---

## 2. Suggested first Codex prompt

Use this after you create an empty repository or local folder.

```text
You are implementing CoreERP, a SaaS-ready multi-tenant ERP backend for Vietnamese SMBs.

Tech stack:
- Node.js LTS
- TypeScript strict mode
- NestJS
- PostgreSQL
- Prisma
- Docker Compose
- JWT + RBAC
- Swagger/OpenAPI
- Jest

Architecture:
- Modular monolith
- PostgreSQL is source of truth
- Prisma for normal CRUD and migrations
- Raw SQL transaction / row-level lock for inventory-critical operations

Current task:
Initialize the NestJS foundation only.

Do not implement all modules yet. Do not add Redis, Kafka, microservices, frontend, or reports.

Requirements:
1. Create NestJS project structure.
2. Enable TypeScript strict mode.
3. Configure /api/v1 global prefix.
4. Add ConfigModule.
5. Add global ValidationPipe.
6. Add Swagger at /api/docs.
7. Add HealthModule with GET /api/v1/health returning:
   { "data": { "status": "ok", "service": "coreerp-api" } }
8. Keep code clean and production-like.
9. Add basic README commands.

Acceptance criteria:
- npm run start:dev works.
- GET /api/v1/health works.
- Swagger opens.
- No unrelated modules are implemented.
```
