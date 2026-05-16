# CoreERP - API Contract v1

Status: Baseline for MVP implementation
Target project: CoreERP - SaaS-ready Multi-tenant ERP Backend for Vietnamese SMBs
Architecture: NestJS modular monolith, PostgreSQL source of truth, Prisma ORM, raw SQL transaction for inventory-critical operations

## 1. API design rules

Base URL:

```http
/api/v1
```

Authentication:

```http
Authorization: Bearer <accessToken>
```

Public endpoints:

```http
GET  /api/v1/health
POST /api/v1/auth/login
```

Tenant isolation rule:

- Client must not send trusted `tenantId` in business request body.
- Backend derives `tenantId`, `userId`, and `role` from JWT.
- Every business query must be scoped by `currentUser.tenantId`.

Response format:

```json
{
  "data": {}
}
```

List response format:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

Error response format:

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Available stock is not enough",
    "details": {}
  }
}
```

## 2. Role permission summary

| Module | TENANT_ADMIN | SALES | WAREHOUSE | FINANCE | VIEWER |
|---|---|---|---|---|---|
| Auth/me | yes | yes | yes | yes | yes |
| Users | yes | no | no | no | no |
| Customers | yes | yes | read | read | read |
| Products | yes | read | read | read | read |
| Warehouses | yes | read | partial | read | read |
| Inventory receive/adjust | yes | no | yes | no | no |
| Sales order create/confirm/cancel | yes | yes | no | no | no |
| Sales order fulfill | yes | no | yes | no | no |
| Invoice/payment | yes | no | no | yes | no |
| Reports/read-only | yes | read | read | yes | read |

## 3. Auth APIs

### 3.1 Login

```http
POST /api/v1/auth/login
Public
```

Request:

```json
{
  "tenantCode": "minh-anh-retail",
  "email": "sales@minhanh.vn",
  "password": "123456"
}
```

Response:

```json
{
  "data": {
    "accessToken": "jwt-token",
    "user": {
      "id": "uuid",
      "tenantId": "uuid",
      "tenantCode": "minh-anh-retail",
      "email": "sales@minhanh.vn",
      "fullName": "Sales User",
      "role": "SALES"
    }
  }
}
```

Business rules:

- Tenant must be ACTIVE.
- User must be ACTIVE.
- Password must match passwordHash.
- JWT payload must include `userId`, `tenantId`, and `role`.

Errors:

| Case | HTTP | Code |
|---|---:|---|
| Invalid tenant/email/password | 401 | INVALID_CREDENTIALS |
| Tenant suspended | 403 | TENANT_SUSPENDED |
| User inactive | 403 | USER_INACTIVE |

### 3.2 Get current user

```http
GET /api/v1/me
Roles: all authenticated users
```

Response includes user id, tenant id, tenant code, email, full name, role, and status.

## 4. User Management APIs

### 4.1 Create tenant user

```http
POST /api/v1/users
Roles: TENANT_ADMIN
```

Request:

```json
{
  "email": "warehouse2@minhanh.vn",
  "password": "123456",
  "fullName": "Warehouse User 2",
  "role": "WAREHOUSE"
}
```

Business rules:

- TENANT_ADMIN can create users only inside the current tenant.
- Client must not send `tenantId`.
- Email must be unique in current tenant.
- MVP does not allow creating PLATFORM_ADMIN.

### 4.2 List users

```http
GET /api/v1/users?role=SALES&status=ACTIVE&page=1&limit=20
Roles: TENANT_ADMIN
```

### 4.3 Update user

```http
PATCH /api/v1/users/:id
Roles: TENANT_ADMIN
```

Request fields: `fullName`, `role`, `status`.

## 5. Customer APIs

```http
POST  /api/v1/customers            Roles: TENANT_ADMIN, SALES
GET   /api/v1/customers            Roles: all authenticated users
GET   /api/v1/customers/:id        Roles: all authenticated users
PATCH /api/v1/customers/:id        Roles: TENANT_ADMIN, SALES
```

Create request:

```json
{
  "code": "CUS001",
  "name": "Nguyen Van A",
  "phone": "0909123456",
  "email": "a@example.com",
  "taxCode": null,
  "type": "B2C"
}
```

Business rules:

- Customer code must be unique in tenant.
- Client must not send `tenantId`.

## 6. Product APIs

```http
POST  /api/v1/products             Roles: TENANT_ADMIN
GET   /api/v1/products             Roles: all authenticated users
GET   /api/v1/products/:id         Roles: all authenticated users
PATCH /api/v1/products/:id         Roles: TENANT_ADMIN
```

Create request:

```json
{
  "sku": "SP001",
  "name": "Ao thun trang",
  "unit": "pcs",
  "basePrice": "120000.00"
}
```

Business rules:

- SKU must be unique in tenant.
- `basePrice >= 0`.
- Updating product name or price must not change old SalesOrderLine or InvoiceLine snapshots.

## 7. Warehouse APIs

```http
POST  /api/v1/warehouses           Roles: TENANT_ADMIN
GET   /api/v1/warehouses           Roles: all authenticated users
GET   /api/v1/warehouses/:id       Roles: all authenticated users
PATCH /api/v1/warehouses/:id       Roles: TENANT_ADMIN
```

Create request:

```json
{
  "code": "HN01",
  "name": "Kho Ha Noi",
  "address": "Ha Noi"
}
```

Business rules:

- Warehouse code must be unique in tenant.

## 8. Inventory APIs

### 8.1 View stock items

```http
GET /api/v1/inventory/stock-items?warehouseId=uuid&productId=uuid&page=1&limit=20
Roles: TENANT_ADMIN, SALES, WAREHOUSE, FINANCE, VIEWER
```

Response item should include `quantityOnHand`, `quantityReserved`, and computed `availableQuantity`.

### 8.2 Receive stock

```http
POST /api/v1/inventory/receipts
Roles: TENANT_ADMIN, WAREHOUSE
```

Request:

```json
{
  "warehouseId": "uuid",
  "productId": "uuid",
  "quantity": 100,
  "note": "Initial stock"
}
```

Business rules:

- `quantity > 0`.
- Warehouse and product must belong to current tenant.
- Create StockItem if it does not exist.
- Increase `quantityOnHand`.
- Create StockMovement type `IN`.

### 8.3 Adjust stock

```http
POST /api/v1/inventory/adjustments
Roles: TENANT_ADMIN, WAREHOUSE
```

Request:

```json
{
  "warehouseId": "uuid",
  "productId": "uuid",
  "newQuantityOnHand": 95,
  "reason": "Manual recount after stock check"
}
```

Business rules:

- `newQuantityOnHand >= quantityReserved`.
- Do not allow adjustment that makes available quantity negative.
- Create StockMovement type `ADJUST`.

### 8.4 View stock movements

```http
GET /api/v1/inventory/movements?warehouseId=uuid&productId=uuid&type=OUT&page=1&limit=20
Roles: TENANT_ADMIN, WAREHOUSE, VIEWER
```

## 9. Sales Order APIs

### 9.1 Create sales order

```http
POST /api/v1/sales-orders
Roles: TENANT_ADMIN, SALES
```

Request:

```json
{
  "customerId": "uuid",
  "warehouseId": "uuid",
  "discountAmount": "0.00",
  "taxAmount": "0.00",
  "note": "Customer wants delivery today",
  "lines": [
    {
      "productId": "uuid",
      "quantity": 5,
      "unitPrice": "120000.00"
    }
  ]
}
```

Business rules:

- Customer, warehouse, and products must belong to current tenant.
- `quantity > 0`.
- `unitPrice >= 0`.
- Snapshot product SKU/name/unit into SalesOrderLine.
- Order starts as DRAFT.
- Creating order does not reserve stock.

### 9.2 List sales orders

```http
GET /api/v1/sales-orders?status=CONFIRMED&customerId=uuid&page=1&limit=20
Roles: all authenticated users
```

### 9.3 Get sales order detail

```http
GET /api/v1/sales-orders/:id
Roles: all authenticated users
```

Detail response should include order, lines, reservations, and invoice summary if any.

### 9.4 Confirm sales order

```http
PATCH /api/v1/sales-orders/:id/confirm
Roles: TENANT_ADMIN, SALES
```

Business rules:

- Only DRAFT orders can be confirmed.
- Confirmation reserves stock transactionally.
- Do not decrease `quantityOnHand`.
- Increase `quantityReserved`.
- Create StockReservation for each SalesOrderLine.
- Create StockMovement type `RESERVE`.
- If any line has insufficient stock, rollback the entire confirmation.

Errors:

| Case | HTTP | Code |
|---|---:|---|
| Order not found | 404 | SALES_ORDER_NOT_FOUND |
| Status is not DRAFT | 409 | INVALID_ORDER_STATUS |
| Not enough stock | 409 | INSUFFICIENT_STOCK |
| Stock item missing | 409 | STOCK_ITEM_NOT_FOUND |

### 9.5 Cancel sales order

```http
PATCH /api/v1/sales-orders/:id/cancel
Roles: TENANT_ADMIN, SALES
```

Business rules:

- DRAFT can be cancelled directly.
- CONFIRMED must release reservations.
- FULFILLED cannot be cancelled in MVP.
- COMPLETED cannot be cancelled.

Effects when cancelling CONFIRMED order:

- Decrease `quantityReserved`.
- Set StockReservation status to RELEASED.
- Create StockMovement type `RELEASE`.
- Set SalesOrder status to CANCELLED.

### 9.6 Fulfill sales order

```http
PATCH /api/v1/sales-orders/:id/fulfill
Roles: TENANT_ADMIN, WAREHOUSE
```

Business rules:

- Only CONFIRMED orders can be fulfilled.
- Order must have RESERVED reservations.
- Fulfillment commits stock OUT.
- Decrease `quantityOnHand`.
- Decrease `quantityReserved`.
- Set StockReservation status to COMMITTED.
- Create StockMovement type `OUT`.
- Set SalesOrder status to FULFILLED.

## 10. Invoice APIs

### 10.1 Generate invoice from sales order

```http
POST /api/v1/invoices/from-sales-order/:salesOrderId
Roles: TENANT_ADMIN, FINANCE
```

Business rules:

- SalesOrder must be FULFILLED.
- One SalesOrder can have at most one Invoice in MVP.
- InvoiceLine snapshots are copied from SalesOrderLine.
- Invoice generation does not change stock.

### 10.2 Issue invoice

```http
PATCH /api/v1/invoices/:id/issue
Roles: TENANT_ADMIN, FINANCE
```

Business rules:

- Only DRAFT invoices can be issued.
- Set status to ISSUED.
- Set `issuedAt = now`.

### 10.3 List invoices

```http
GET /api/v1/invoices?status=ISSUED&customerId=uuid&page=1&limit=20
Roles: TENANT_ADMIN, FINANCE, VIEWER
```

### 10.4 Get invoice detail

```http
GET /api/v1/invoices/:id
Roles: TENANT_ADMIN, FINANCE, VIEWER
```

## 11. Payment APIs

### 11.1 Record payment

```http
POST /api/v1/invoices/:id/payments
Roles: TENANT_ADMIN, FINANCE
```

Request:

```json
{
  "amount": "300000.00",
  "method": "BANK_TRANSFER",
  "referenceNo": "VCB123456",
  "paidAt": "2026-05-16T10:00:00.000Z"
}
```

Business rules:

- Invoice must be ISSUED or PARTIALLY_PAID.
- `amount > 0`.
- `paidAmount + amount <= totalAmount`.
- If paidAmount < totalAmount, set invoice status to PARTIALLY_PAID.
- If paidAmount = totalAmount, set invoice status to PAID.
- If invoice becomes PAID and order is FULFILLED, set SalesOrder status to COMPLETED.

### 11.2 List payments

```http
GET /api/v1/payments?invoiceId=uuid&page=1&limit=20
Roles: TENANT_ADMIN, FINANCE, VIEWER
```

## 12. Audit APIs

```http
GET /api/v1/audit-logs?entityType=SalesOrder&entityId=uuid&page=1&limit=20
Roles: TENANT_ADMIN
```

MVP audit actions:

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

## 13. Health API

```http
GET /api/v1/health
Public
```

Response:

```json
{
  "data": {
    "status": "ok",
    "service": "coreerp-api"
  }
}
```

## 14. Standard error codes

- INVALID_CREDENTIALS
- TENANT_SUSPENDED
- USER_INACTIVE
- FORBIDDEN
- CUSTOMER_NOT_FOUND
- PRODUCT_NOT_FOUND
- WAREHOUSE_NOT_FOUND
- SALES_ORDER_NOT_FOUND
- INVOICE_NOT_FOUND
- INVALID_ORDER_STATUS
- ORDER_LINES_REQUIRED
- INSUFFICIENT_STOCK
- STOCK_ITEM_NOT_FOUND
- RESERVATION_NOT_FOUND
- INVALID_RESERVATION_STATUS
- ORDER_NOT_FULFILLED
- INVOICE_ALREADY_EXISTS
- INVOICE_NOT_ISSUED
- INVOICE_ALREADY_PAID
- PAYMENT_EXCEEDS_REMAINING
- DUPLICATE_SKU
- DUPLICATE_CUSTOMER_CODE
- DUPLICATE_WAREHOUSE_CODE
- VALIDATION_ERROR

## 15. APIs intentionally excluded from MVP

- POST /api/v1/platform/tenants
- POST /api/v1/auth/register-company
- POST /api/v1/auth/refresh
- POST /api/v1/auth/logout
- POST /api/v1/inventory/reservations
- GET /api/v1/reports/revenue
- GET /api/v1/reports/low-stock

Rationale:

- Tenant creation is MVP+.
- Public company signup is not MVP.
- Refresh token/logout can be added after access-token login works.
- Reservation is internal service logic, not public API.
- Reports can be added after core flow has data.
