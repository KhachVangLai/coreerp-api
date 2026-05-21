# CoreERP Demo Guide

This guide walks through the local Swagger demo for the MVP Order-to-Cash flow.

## 1. Start The Stack

Start PostgreSQL:

```bash
docker compose up -d
```

Install dependencies if needed:

```bash
npm install
```

Create `.env` from the example file if it does not exist:

```bash
cp .env.example .env
```

Run migration, generate Prisma Client, and seed demo accounts:

```bash
npm run prisma:migrate
npm run prisma:generate
npm run db:seed
```

Start the API:

```bash
npm run start:dev
```

Open Swagger:

```text
http://localhost:3000/api/docs
```

## 2. Login And Authorize Swagger

Use `POST /api/v1/auth/login`.

Tenant admin:

```json
{
  "tenantCode": "minh-anh-retail",
  "email": "admin@minhanh.vn",
  "password": "123456"
}
```

Other useful demo users:

| role | tenantCode | email | password |
|---|---|---|---|
| SALES | minh-anh-retail | sales@minhanh.vn | 123456 |
| WAREHOUSE | minh-anh-retail | warehouse@minhanh.vn | 123456 |
| FINANCE | minh-anh-retail | finance@minhanh.vn | 123456 |
| VIEWER | minh-anh-retail | viewer@minhanh.vn | 123456 |

Copy `data.accessToken`, click Swagger `Authorize`, and enter:

```text
Bearer <accessToken>
```

## 3. Create Master Data

Create customer with `POST /api/v1/customers`:

```json
{
  "code": "CUS-DEMO-001",
  "name": "Nguyen Van A",
  "phone": "0909123456",
  "email": "a@example.com",
  "taxCode": null,
  "type": "B2C"
}
```

Create product with `POST /api/v1/products`:

```json
{
  "sku": "SP-DEMO-001",
  "name": "Ao thun trang",
  "unit": "pcs",
  "basePrice": "120000.00"
}
```

Create warehouse with `POST /api/v1/warehouses`:

```json
{
  "code": "HN-DEMO-01",
  "name": "Kho Ha Noi",
  "address": "Ha Noi"
}
```

Keep the returned `customerId`, `productId`, and `warehouseId`.

## 4. Receive Stock

Login as `TENANT_ADMIN` or `WAREHOUSE`.

Use `POST /api/v1/inventory/receipts`:

```json
{
  "warehouseId": "<warehouseId>",
  "productId": "<productId>",
  "quantity": 10,
  "note": "Initial demo stock"
}
```

Check `GET /api/v1/inventory/stock-items`.

Expected stock:

- `quantityOnHand = 10`
- `quantityReserved = 0`
- `availableQuantity = 10`

## 5. Create Sales Order

Login as `TENANT_ADMIN` or `SALES`.

Use `POST /api/v1/sales-orders`:

```json
{
  "customerId": "<customerId>",
  "warehouseId": "<warehouseId>",
  "discountAmount": "0.00",
  "taxAmount": "0.00",
  "note": "Demo order",
  "lines": [
    {
      "productId": "<productId>",
      "quantity": 7,
      "unitPrice": "120000.00"
    }
  ]
}
```

Expected result:

- Sales order status is `DRAFT`.
- Sales order line snapshots product SKU, name, unit, and unit price.
- No stock reservation is created yet.

## 6. Confirm Sales Order

Use `PATCH /api/v1/sales-orders/:id/confirm`:

```json
{
  "note": "Confirmed by sales"
}
```

Expected result:

- Sales order status is `CONFIRMED`.
- `StockReservation` status is `RESERVED`.
- `quantityOnHand` remains `10`.
- `quantityReserved` becomes `7`.
- `availableQuantity` becomes `3`.
- A `RESERVE` stock movement exists.

## 7. Fulfill Sales Order

Login as `TENANT_ADMIN` or `WAREHOUSE`.

Use `PATCH /api/v1/sales-orders/:id/fulfill`:

```json
{
  "note": "Picked and shipped"
}
```

Expected result:

- Sales order status is `FULFILLED`.
- Reservation status is `COMMITTED`.
- `quantityOnHand` becomes `3`.
- `quantityReserved` becomes `0`.
- `availableQuantity` remains `3`.
- An `OUT` stock movement exists.

## 8. Generate And Issue Invoice

Login as `TENANT_ADMIN` or `FINANCE`.

Generate invoice with `POST /api/v1/invoices/from-sales-order/:salesOrderId`:

```json
{
  "note": "Generate invoice after fulfillment"
}
```

Expected result:

- Invoice status is `DRAFT`.
- Invoice total equals sales order total.
- Invoice lines snapshot sales order line data.
- Stock does not change.

Issue invoice with `PATCH /api/v1/invoices/:id/issue`:

```json
{
  "note": "Issued to customer"
}
```

Expected result:

- Invoice status is `ISSUED`.
- Sales order remains `FULFILLED`.

## 9. Record Payments

Record partial payment with `POST /api/v1/invoices/:id/payments`:

```json
{
  "amount": "300000.00",
  "method": "BANK_TRANSFER",
  "referenceNo": "VCB-DEMO-001",
  "paidAt": "2026-05-21T10:00:00.000Z"
}
```

Expected result:

- Invoice status is `PARTIALLY_PAID`.
- Sales order remains `FULFILLED`.
- Stock does not change.

Record the remaining payment:

```json
{
  "amount": "540000.00",
  "method": "BANK_TRANSFER",
  "referenceNo": "VCB-DEMO-002",
  "paidAt": "2026-05-21T10:05:00.000Z"
}
```

Expected result:

- Invoice status is `PAID`.
- Sales order status is `COMPLETED`.
- Stock does not change.

## 10. Check Audit Logs

Login as `TENANT_ADMIN`.

Use `GET /api/v1/audit-logs`.

Expected major actions:

- `CUSTOMER_CREATED`
- `PRODUCT_CREATED`
- `WAREHOUSE_CREATED`
- `STOCK_RECEIVED`
- `SALES_ORDER_CREATED`
- `SALES_ORDER_CONFIRMED`
- `SALES_ORDER_FULFILLED`
- `INVOICE_GENERATED`
- `INVOICE_ISSUED`
- `PAYMENT_RECORDED`
- `SALES_ORDER_COMPLETED`

Non-admin roles should receive `FORBIDDEN` for audit log access.

## Useful Negative Checks

Overselling prevention:

1. Keep available quantity at `3` after confirming an order quantity `7`.
2. Create another sales order for quantity `5`.
3. Confirming the second order should return `INSUFFICIENT_STOCK`.

Tenant isolation:

1. Login to `hoang-long-fashion`.
2. Create its own customer/product/warehouse/order.
3. Login to `minh-anh-retail`.
4. Try reading the other tenant's IDs.
5. Cross-tenant reads should return `NOT_FOUND`.
