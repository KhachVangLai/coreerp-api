# CoreERP Prisma Schema v1 Notes

## Purpose
This schema is the first database baseline for CoreERP MVP. It should be treated as a planning/implementation input before coding the NestJS modules.

## MVP assumptions

- CoreERP is a SaaS-ready multi-tenant ERP backend.
- MVP focuses on Order-to-Cash: Sales Order -> Stock Reservation -> Warehouse Fulfillment -> Invoice Snapshot -> Payment.
- One user belongs to one tenant.
- Tenants are seeded for MVP; runtime tenant creation is deferred.
- One sales order uses one warehouse.
- One sales order has at most one invoice.
- Quantity uses Int.
- Money uses Decimal(12,2).
- Invoice does not reduce stock.
- Stock is reduced only when Warehouse fulfills an order.

## Key models

- Tenant, User
- Customer, Product, Warehouse
- StockItem, StockMovement, StockReservation
- SalesOrder, SalesOrderLine
- Invoice, InvoiceLine, Payment
- AuditLog

## Important rules

1. Every business table has tenantId.
2. Backend must never trust tenantId from client input.
3. Product SKU is unique per tenant, not globally.
4. Warehouse code is unique per tenant, not globally.
5. StockItem is unique by tenant + warehouse + product.
6. SalesOrderLine and InvoiceLine both store product snapshots.
7. StockReservation is linked to SalesOrderLine.
8. StockMovement is an append-only ledger conceptually.
9. Inventory reservation/fulfillment should use PostgreSQL transaction + row-level lock.
10. Prisma is used for normal CRUD and migration; raw SQL is allowed for critical inventory flow.

## Critical transaction flows

### Confirm Sales Order

- Lock stock_items rows with SELECT ... FOR UPDATE.
- Check available = quantity_on_hand - quantity_reserved.
- Increase quantity_reserved.
- Insert stock_reservations.
- Insert stock_movements with type RESERVE.
- Change sales_order status to CONFIRMED.

### Cancel Sales Order

- Lock related stock_items and stock_reservations.
- Decrease quantity_reserved.
- Mark reservation RELEASED.
- Insert stock_movements with type RELEASE.
- Change sales_order status to CANCELLED.

### Fulfill Sales Order

- Lock related stock_items and stock_reservations.
- Decrease quantity_on_hand.
- Decrease quantity_reserved.
- Mark reservation COMMITTED.
- Insert stock_movements with type OUT.
- Change sales_order status to FULFILLED.

## Deferred / not in MVP

- PlatformAdmin table
- UserTenantMembership
- Permission table
- PurchaseOrder
- Supplier
- Accounting ledger
- OutboxEvent
- Kafka/Redpanda
- Redis cache
- Advanced reports
- Public tenant signup

## Next step

After this schema is reviewed, create API Contract v1:

- endpoint
- request body
- response body
- required role
- business rule
- error cases
