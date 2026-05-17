# CoreERP M2 Tenant Ownership TODO

M2 services must enforce tenant ownership in every relation lookup before creating or updating tenant-owned records.

Every tenant-scoped query must include `currentUser.tenantId` from authenticated context. Future business services must never trust `tenantId` from client request bodies, query strings, or route parameters.

Examples:

- Query tenant-scoped records with `{ id: customerId, tenantId: currentUser.tenantId }`, not only `{ id: customerId }`.
- A `SalesOrder` must only reference a `Customer` and `Warehouse` owned by the authenticated tenant.
- A `SalesOrderLine` must only reference a `Product` owned by the authenticated tenant.
- A `StockReservation` must only reference order lines, warehouses, and products owned by the same tenant.
- An `Invoice` and `Payment` must only reference sales orders, customers, invoices, and users owned by the same tenant.

The current Prisma schema uses tenant-scoped unique constraints and tenant indexes, but full composite tenant-scoped foreign key hardening is deferred to a later database hardening task. Until that task is done, service-layer tenant checks are mandatory.
