import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  CustomerType,
  PaymentMethod,
  RecordStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
// supertest is CommonJS in this project; require import keeps runtime callable.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import request = require('supertest');

import { AppModule } from '../app.module';
import { ErrorCode } from '../common/errors/error-code.enum';
import { GlobalExceptionFilter } from '../common/filters/global-exception.filter';
import { ResponseInterceptor } from '../common/interceptors/response.interceptor';
import { PrismaService } from '../prisma/prisma.service';

jest.setTimeout(120_000);

type ApiResponse<TData> = {
  data: TData;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type SupertestApp = Parameters<typeof request>[0];

type ApiErrorResponse = {
  error: {
    code: string;
    message: string;
    details: unknown;
  };
};

type LoginData = {
  accessToken: string;
  user: {
    id: string;
    tenantId: string;
    tenantCode: string;
    email: string;
    fullName: string;
    role: UserRole;
    status: UserStatus;
  };
};

type CustomerData = {
  id: string;
  code: string;
  name: string;
};

type ProductData = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  basePrice: string;
};

type WarehouseData = {
  id: string;
  code: string;
  name: string;
};

type StockItemData = {
  id: string;
  warehouseId: string;
  productId: string;
  quantityOnHand: number;
  quantityReserved: number;
  availableQuantity: number;
};

type StockMovementData = {
  id: string;
  type: string;
  warehouseId: string;
  productId: string;
  referenceId: string | null;
};

type SalesOrderLineData = {
  id: string;
  productId: string;
  skuSnapshot: string;
  productNameSnapshot: string;
  unitSnapshot: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
};

type SalesOrderData = {
  id: string;
  orderCode: string;
  customerId: string;
  warehouseId: string;
  status: string;
  totalAmount: string;
  lines: SalesOrderLineData[];
};

type ConfirmSalesOrderData = {
  id: string;
  status: string;
  reservations: ReservationData[];
};

type CancelSalesOrderData = {
  id: string;
  status: string;
  releasedReservations: ReservationData[];
};

type FulfillSalesOrderData = {
  id: string;
  status: string;
  committedReservations: ReservationData[];
};

type ReservationData = {
  id: string;
  salesOrderLineId: string;
  warehouseId: string;
  productId: string;
  quantity: number;
  status: string;
};

type InvoiceLineData = {
  id: string;
  productId: string | null;
  skuSnapshot: string;
  productNameSnapshot: string;
  unitSnapshot: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
};

type InvoiceData = {
  id: string;
  invoiceCode: string;
  salesOrderId: string;
  customerId: string;
  status: string;
  totalAmount: string;
  paidAmount: string;
  lines: InvoiceLineData[];
};

type RecordPaymentData = {
  payment: {
    id: string;
    invoiceId: string;
    amount: string;
    method: PaymentMethod;
  };
  invoice: {
    id: string;
    status: string;
    totalAmount: string;
    paidAmount: string;
  };
  salesOrder: {
    id: string;
    status: string;
  };
};

type PaymentData = {
  id: string;
  invoiceId: string;
  amount: string;
};

type AuditLogData = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: unknown;
};

type AuthSession = {
  token: string;
  user: LoginData['user'];
};

type MasterData = {
  customer: CustomerData;
  product: ProductData;
  warehouse: WarehouseData;
};

type FulfilledOrderContext = MasterData & {
  order: SalesOrderData;
};

describe('CoreERP MVP Order-to-Cash E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let httpServer: SupertestApp;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    prisma = app.get(PrismaService);
    const configService = app.get(ConfigService);

    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new GlobalExceptionFilter());

    await ensureDemoAccounts();
    await app.init();
    httpServer = app.getHttpServer() as SupertestApp;

    expect(configService.get<string>('app.nodeEnv')).toBeDefined();
  });

  afterAll(async () => {
    await app.close();
  });

  it('runs the full Order-to-Cash happy path and records audit logs', async () => {
    const suffix = uniqueSuffix('happy');
    const admin = await login('minh-anh-retail', 'admin@minhanh.vn');
    const finance = await login('minh-anh-retail', 'finance@minhanh.vn');

    const master = await createMasterData(admin.token, suffix);
    await receiveStock(admin.token, master, 10);

    const order = await createSalesOrder(admin.token, master, 7, '100000.00');
    const confirmed = await confirmSalesOrder(admin.token, order.id);
    expect(confirmed.status).toBe('CONFIRMED');
    expect(confirmed.reservations).toHaveLength(1);

    await expectStock(master, {
      quantityOnHand: 10,
      quantityReserved: 7,
      availableQuantity: 3,
    });

    const fulfilled = await fulfillSalesOrder(admin.token, order.id);
    expect(fulfilled.status).toBe('FULFILLED');
    expect(fulfilled.committedReservations[0].status).toBe('COMMITTED');

    await expectStock(master, {
      quantityOnHand: 3,
      quantityReserved: 0,
      availableQuantity: 3,
    });

    const invoice = await generateInvoice(finance.token, order.id);
    expect(invoice.status).toBe('DRAFT');
    expect(invoice.totalAmount).toBe(order.totalAmount);

    const issuedInvoice = await issueInvoice(finance.token, invoice.id);
    expect(issuedInvoice.status).toBe('ISSUED');

    const partialPayment = await recordPayment(
      finance.token,
      invoice.id,
      '300000.00',
    );
    expect(partialPayment.invoice.status).toBe('PARTIALLY_PAID');
    expect(partialPayment.invoice.paidAmount).toBe('300000.00');
    expect(partialPayment.salesOrder.status).toBe('FULFILLED');

    const fullPayment = await recordPayment(
      finance.token,
      invoice.id,
      '400000.00',
    );
    expect(fullPayment.invoice.status).toBe('PAID');
    expect(fullPayment.invoice.paidAmount).toBe('700000.00');
    expect(fullPayment.salesOrder.status).toBe('COMPLETED');

    await expectStock(master, {
      quantityOnHand: 3,
      quantityReserved: 0,
      availableQuantity: 3,
    });

    const auditLogs = await listAuditLogs(admin.token, { limit: 100 });
    const actions = auditLogs.data.map((log) => log.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'CUSTOMER_CREATED',
        'PRODUCT_CREATED',
        'WAREHOUSE_CREATED',
        'STOCK_RECEIVED',
        'SALES_ORDER_CREATED',
        'SALES_ORDER_CONFIRMED',
        'SALES_ORDER_FULFILLED',
        'INVOICE_GENERATED',
        'INVOICE_ISSUED',
        'PAYMENT_RECORDED',
        'SALES_ORDER_COMPLETED',
      ]),
    );
  });

  it('prevents overselling and leaves stock quantities unchanged on failure', async () => {
    const suffix = uniqueSuffix('oversell');
    const admin = await login('minh-anh-retail', 'admin@minhanh.vn');
    const master = await createMasterData(admin.token, suffix);

    await receiveStock(admin.token, master, 10);
    const orderA = await createSalesOrder(admin.token, master, 7, '100000.00');
    await confirmSalesOrder(admin.token, orderA.id);

    const orderB = await createSalesOrder(admin.token, master, 5, '100000.00');
    const response = await request(httpServer)
      .patch(`/api/v1/sales-orders/${orderB.id}/confirm`)
      .set(authHeader(admin.token))
      .send({ note: 'Should fail' });

    expect(response.status).toBe(409);
    expect(apiError(response.body).error.code).toBe(
      ErrorCode.INSUFFICIENT_STOCK,
    );

    await expectStock(master, {
      quantityOnHand: 10,
      quantityReserved: 7,
      availableQuantity: 3,
    });
  });

  it('cancels confirmed orders and releases reserved stock', async () => {
    const suffix = uniqueSuffix('cancel');
    const admin = await login('minh-anh-retail', 'admin@minhanh.vn');
    const master = await createMasterData(admin.token, suffix);

    await receiveStock(admin.token, master, 10);
    const order = await createSalesOrder(admin.token, master, 7, '100000.00');
    await confirmSalesOrder(admin.token, order.id);

    const cancelled = await cancelSalesOrder(admin.token, order.id);
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.releasedReservations).toHaveLength(1);
    expect(cancelled.releasedReservations[0].status).toBe('RELEASED');

    await expectStock(master, {
      quantityOnHand: 10,
      quantityReserved: 0,
      availableQuantity: 10,
    });

    const movements = await listMovements(admin.token, {
      warehouseId: master.warehouse.id,
      productId: master.product.id,
      type: 'RELEASE',
      referenceId: order.id,
    });
    expect(movements.data).toHaveLength(1);
  });

  it('enforces RBAC across the MVP workflow', async () => {
    const suffix = uniqueSuffix('rbac');
    const admin = await login('minh-anh-retail', 'admin@minhanh.vn');
    const sales = await login('minh-anh-retail', 'sales@minhanh.vn');
    const warehouseUser = await login(
      'minh-anh-retail',
      'warehouse@minhanh.vn',
    );
    const finance = await login('minh-anh-retail', 'finance@minhanh.vn');
    const viewer = await login('minh-anh-retail', 'viewer@minhanh.vn');

    await expectForbidden(
      request(httpServer)
        .post('/api/v1/products')
        .set(authHeader(sales.token))
        .send(productBody(`${suffix}-sales-denied`)),
    );
    await expectForbidden(
      request(httpServer)
        .post('/api/v1/warehouses')
        .set(authHeader(sales.token))
        .send(warehouseBody(`${suffix}-sales-denied`)),
    );
    await expectForbidden(
      request(httpServer)
        .post('/api/v1/customers')
        .set(authHeader(viewer.token))
        .send(customerBody(`${suffix}-viewer-denied`)),
    );

    const master = await createMasterData(admin.token, suffix);
    await receiveStock(admin.token, master, 10);

    await expectForbidden(
      request(httpServer)
        .post('/api/v1/sales-orders')
        .set(authHeader(warehouseUser.token))
        .send(salesOrderBody(master, 2, '100000.00')),
    );

    const order = await createSalesOrder(sales.token, master, 2, '100000.00');
    await confirmSalesOrder(sales.token, order.id);

    await expectForbidden(
      request(httpServer)
        .patch(`/api/v1/sales-orders/${order.id}/fulfill`)
        .set(authHeader(sales.token))
        .send({ note: 'Sales cannot fulfill' }),
    );

    await fulfillSalesOrder(admin.token, order.id);
    const invoice = await generateInvoice(finance.token, order.id);
    const issuedInvoice = await issueInvoice(finance.token, invoice.id);
    const payment = await recordPayment(
      finance.token,
      issuedInvoice.id,
      '200000.00',
    );

    expect(payment.invoice.status).toBe('PAID');

    const auditLogs = await listAuditLogs(admin.token, { limit: 5 });
    expect(auditLogs.data.length).toBeGreaterThan(0);
  });

  it('keeps tenant data isolated and returns NOT_FOUND for cross-tenant access', async () => {
    const suffix = uniqueSuffix('tenant');
    const adminA = await login('minh-anh-retail', 'admin@minhanh.vn');
    const adminB = await login('hoang-long-fashion', 'admin@hoanglong.vn');
    const financeB = await login('hoang-long-fashion', 'finance@hoanglong.vn');

    const masterA = await createMasterData(adminA.token, `${suffix}-a`);
    const masterB = await createMasterData(adminB.token, `${suffix}-b`);
    const contextB = await prepareFulfilledOrder(
      adminB.token,
      `${suffix}-b`,
      masterB,
      2,
    );
    const invoiceB = await issueInvoice(
      financeB.token,
      (await generateInvoice(financeB.token, contextB.order.id)).id,
    );
    await recordPayment(financeB.token, invoiceB.id, invoiceB.totalAmount);

    await expectNotFound(
      request(httpServer)
        .get(`/api/v1/customers/${masterB.customer.id}`)
        .set(authHeader(adminA.token)),
    );
    await expectNotFound(
      request(httpServer)
        .patch(`/api/v1/products/${masterB.product.id}`)
        .set(authHeader(adminA.token))
        .send({ name: 'Cross Tenant Update' }),
    );
    await expectNotFound(
      request(httpServer)
        .get(`/api/v1/warehouses/${masterB.warehouse.id}`)
        .set(authHeader(adminA.token)),
    );
    await expectNotFound(
      request(httpServer)
        .get(`/api/v1/sales-orders/${contextB.order.id}`)
        .set(authHeader(adminA.token)),
    );
    await expectNotFound(
      request(httpServer)
        .get(`/api/v1/invoices/${invoiceB.id}`)
        .set(authHeader(adminA.token)),
    );

    const customersA = await listCustomers(adminA.token, masterB.customer.code);
    const productsA = await listProducts(adminA.token, masterB.product.sku);
    const warehousesA = await listWarehouses(adminA.token, masterB.warehouse.code);
    const ordersA = await listSalesOrdersByCustomerId(
      adminA.token,
      masterB.customer.id,
    );
    const invoicesA = await listInvoicesBySalesOrderId(
      adminA.token,
      contextB.order.id,
    );
    const paymentsA = await listPayments(adminA.token, invoiceB.id);

    expect(customersA.data).toHaveLength(0);
    expect(productsA.data).toHaveLength(0);
    expect(warehousesA.data).toHaveLength(0);
    expect(ordersA.data).toHaveLength(0);
    expect(invoicesA.data).toHaveLength(0);
    expect(paymentsA.data).toHaveLength(0);

    const customersOwnTenant = await listCustomers(adminA.token, masterA.customer.code);
    expect(customersOwnTenant.data).toHaveLength(1);
  });

  it('keeps sales order and invoice snapshots unchanged after product updates', async () => {
    const suffix = uniqueSuffix('snapshot');
    const admin = await login('minh-anh-retail', 'admin@minhanh.vn');
    const finance = await login('minh-anh-retail', 'finance@minhanh.vn');
    const master = await createMasterData(admin.token, suffix);
    const originalProductName = master.product.name;

    const context = await prepareFulfilledOrder(admin.token, suffix, master, 3);
    const invoice = await generateInvoice(finance.token, context.order.id);

    await request(httpServer)
      .patch(`/api/v1/products/${master.product.id}`)
      .set(authHeader(admin.token))
      .send({
        name: `${originalProductName} Updated`,
        basePrice: '999999.00',
        status: RecordStatus.ACTIVE,
      })
      .expect(200);

    const orderDetail = await getSalesOrder(admin.token, context.order.id);
    const invoiceDetail = await getInvoice(finance.token, invoice.id);

    expect(orderDetail.lines[0].productNameSnapshot).toBe(originalProductName);
    expect(orderDetail.lines[0].unitPrice).toBe('100000.00');
    expect(invoiceDetail.lines[0].productNameSnapshot).toBe(originalProductName);
    expect(invoiceDetail.lines[0].unitPrice).toBe('100000.00');
  });

  it('enforces payment rules without changing stock or movement ledger', async () => {
    const suffix = uniqueSuffix('payment');
    const admin = await login('minh-anh-retail', 'admin@minhanh.vn');
    const finance = await login('minh-anh-retail', 'finance@minhanh.vn');
    const context = await prepareFulfilledOrder(admin.token, suffix, undefined, 4);
    const draftInvoice = await generateInvoice(finance.token, context.order.id);

    const draftPaymentResponse = await request(httpServer)
      .post(`/api/v1/invoices/${draftInvoice.id}/payments`)
      .set(authHeader(finance.token))
      .send(paymentBody('100000.00'));
    expect(draftPaymentResponse.status).toBe(409);
    expect(apiError(draftPaymentResponse.body).error.code).toBe(ErrorCode.CONFLICT);

    const issuedInvoice = await issueInvoice(finance.token, draftInvoice.id);
    const beforeStock = await getStockItem(context);
    const beforeMovements = await listMovements(admin.token, {
      warehouseId: context.warehouse.id,
      productId: context.product.id,
    });

    const overpayResponse = await request(httpServer)
      .post(`/api/v1/invoices/${issuedInvoice.id}/payments`)
      .set(authHeader(finance.token))
      .send(paymentBody('999999.00'));
    expect(overpayResponse.status).toBe(409);
    expect(apiError(overpayResponse.body).error.code).toBe(
      ErrorCode.PAYMENT_EXCEEDS_REMAINING,
    );

    await recordPayment(finance.token, issuedInvoice.id, issuedInvoice.totalAmount);

    const paidAgainResponse = await request(httpServer)
      .post(`/api/v1/invoices/${issuedInvoice.id}/payments`)
      .set(authHeader(finance.token))
      .send(paymentBody('1.00'));
    expect(paidAgainResponse.status).toBe(409);
    expect(apiError(paidAgainResponse.body).error.code).toBe(ErrorCode.CONFLICT);

    const afterStock = await getStockItem(context);
    const afterMovements = await listMovements(admin.token, {
      warehouseId: context.warehouse.id,
      productId: context.product.id,
    });

    expect(afterStock).toMatchObject({
      quantityOnHand: beforeStock.quantityOnHand,
      quantityReserved: beforeStock.quantityReserved,
      availableQuantity: beforeStock.availableQuantity,
    });
    expect(afterMovements.data).toHaveLength(beforeMovements.data.length);
  });

  async function ensureDemoAccounts(): Promise<void> {
    const passwordHash = await bcrypt.hash('123456', 10);
    const tenants = [
      {
        code: 'minh-anh-retail',
        name: 'Minh Anh Retail Co.',
        domain: 'minhanh.vn',
      },
      {
        code: 'hoang-long-fashion',
        name: 'Hoang Long Fashion Co.',
        domain: 'hoanglong.vn',
      },
    ];

    for (const tenantFixture of tenants) {
      const tenant = await prisma.tenant.upsert({
        where: { code: tenantFixture.code },
        create: {
          code: tenantFixture.code,
          name: tenantFixture.name,
          status: 'ACTIVE',
        },
        update: {
          name: tenantFixture.name,
          status: 'ACTIVE',
        },
      });

      for (const role of [
        UserRole.TENANT_ADMIN,
        UserRole.SALES,
        UserRole.WAREHOUSE,
        UserRole.FINANCE,
        UserRole.VIEWER,
      ]) {
        const localPart =
          role === UserRole.TENANT_ADMIN ? 'admin' : role.toLowerCase();

        await prisma.user.upsert({
          where: {
            tenantId_email: {
              tenantId: tenant.id,
              email: `${localPart}@${tenantFixture.domain}`,
            },
          },
          create: {
            tenantId: tenant.id,
            email: `${localPart}@${tenantFixture.domain}`,
            passwordHash,
            fullName: `${role} User`,
            role,
            status: UserStatus.ACTIVE,
          },
          update: {
            passwordHash,
            role,
            status: UserStatus.ACTIVE,
          },
        });
      }
    }
  }

  async function login(tenantCode: string, email: string): Promise<AuthSession> {
    const response = await request(httpServer)
      .post('/api/v1/auth/login')
      .send({ tenantCode, email, password: '123456' })
      .expect(200);
    const data = apiData<LoginData>(response.body);

    return {
      token: data.accessToken,
      user: data.user,
    };
  }

  async function createMasterData(
    token: string,
    suffix: string,
  ): Promise<MasterData> {
    const [customer, product, warehouse] = await Promise.all([
      createCustomer(token, suffix),
      createProduct(token, suffix),
      createWarehouse(token, suffix),
    ]);

    return { customer, product, warehouse };
  }

  async function prepareFulfilledOrder(
    token: string,
    suffix: string,
    existingMaster?: MasterData,
    quantity = 2,
  ): Promise<FulfilledOrderContext> {
    const master = existingMaster ?? (await createMasterData(token, suffix));

    await receiveStock(token, master, 10);
    const order = await createSalesOrder(token, master, quantity, '100000.00');
    await confirmSalesOrder(token, order.id);
    await fulfillSalesOrder(token, order.id);

    return { ...master, order };
  }

  async function createCustomer(
    token: string,
    suffix: string,
  ): Promise<CustomerData> {
    const response = await request(httpServer)
      .post('/api/v1/customers')
      .set(authHeader(token))
      .send(customerBody(suffix))
      .expect(201);

    return apiData<CustomerData>(response.body);
  }

  async function createProduct(
    token: string,
    suffix: string,
  ): Promise<ProductData> {
    const response = await request(httpServer)
      .post('/api/v1/products')
      .set(authHeader(token))
      .send(productBody(suffix))
      .expect(201);

    return apiData<ProductData>(response.body);
  }

  async function createWarehouse(
    token: string,
    suffix: string,
  ): Promise<WarehouseData> {
    const response = await request(httpServer)
      .post('/api/v1/warehouses')
      .set(authHeader(token))
      .send(warehouseBody(suffix))
      .expect(201);

    return apiData<WarehouseData>(response.body);
  }

  async function receiveStock(
    token: string,
    master: MasterData,
    quantity: number,
  ): Promise<void> {
    await request(httpServer)
      .post('/api/v1/inventory/receipts')
      .set(authHeader(token))
      .send({
        warehouseId: master.warehouse.id,
        productId: master.product.id,
        quantity,
        note: 'E2E stock receipt',
      })
      .expect(201);
  }

  async function createSalesOrder(
    token: string,
    master: MasterData,
    quantity: number,
    unitPrice: string,
  ): Promise<SalesOrderData> {
    const response = await request(httpServer)
      .post('/api/v1/sales-orders')
      .set(authHeader(token))
      .send(salesOrderBody(master, quantity, unitPrice))
      .expect(201);

    return apiData<SalesOrderData>(response.body);
  }

  async function confirmSalesOrder(
    token: string,
    orderId: string,
  ): Promise<ConfirmSalesOrderData> {
    const response = await request(httpServer)
      .patch(`/api/v1/sales-orders/${orderId}/confirm`)
      .set(authHeader(token))
      .send({ note: 'E2E confirmation' })
      .expect(200);

    return apiData<ConfirmSalesOrderData>(response.body);
  }

  async function cancelSalesOrder(
    token: string,
    orderId: string,
  ): Promise<CancelSalesOrderData> {
    const response = await request(httpServer)
      .patch(`/api/v1/sales-orders/${orderId}/cancel`)
      .set(authHeader(token))
      .send({ reason: 'E2E cancellation' })
      .expect(200);

    return apiData<CancelSalesOrderData>(response.body);
  }

  async function fulfillSalesOrder(
    token: string,
    orderId: string,
  ): Promise<FulfillSalesOrderData> {
    const response = await request(httpServer)
      .patch(`/api/v1/sales-orders/${orderId}/fulfill`)
      .set(authHeader(token))
      .send({ note: 'E2E fulfillment' })
      .expect(200);

    return apiData<FulfillSalesOrderData>(response.body);
  }

  async function generateInvoice(
    token: string,
    orderId: string,
  ): Promise<InvoiceData> {
    const response = await request(httpServer)
      .post(`/api/v1/invoices/from-sales-order/${orderId}`)
      .set(authHeader(token))
      .send({ note: 'E2E invoice generation' })
      .expect(201);

    return apiData<InvoiceData>(response.body);
  }

  async function issueInvoice(
    token: string,
    invoiceId: string,
  ): Promise<InvoiceData> {
    const response = await request(httpServer)
      .patch(`/api/v1/invoices/${invoiceId}/issue`)
      .set(authHeader(token))
      .send({ note: 'E2E invoice issue' })
      .expect(200);

    return apiData<InvoiceData>(response.body);
  }

  async function recordPayment(
    token: string,
    invoiceId: string,
    amount: string,
  ): Promise<RecordPaymentData> {
    const response = await request(httpServer)
      .post(`/api/v1/invoices/${invoiceId}/payments`)
      .set(authHeader(token))
      .send(paymentBody(amount))
      .expect(201);

    return apiData<RecordPaymentData>(response.body);
  }

  async function getSalesOrder(
    token: string,
    orderId: string,
  ): Promise<SalesOrderData> {
    const response = await request(httpServer)
      .get(`/api/v1/sales-orders/${orderId}`)
      .set(authHeader(token))
      .expect(200);

    return apiData<SalesOrderData>(response.body);
  }

  async function getInvoice(
    token: string,
    invoiceId: string,
  ): Promise<InvoiceData> {
    const response = await request(httpServer)
      .get(`/api/v1/invoices/${invoiceId}`)
      .set(authHeader(token))
      .expect(200);

    return apiData<InvoiceData>(response.body);
  }

  async function getStockItem(master: MasterData): Promise<StockItemData> {
    const admin = await login('minh-anh-retail', 'admin@minhanh.vn');
    const response = await request(httpServer)
      .get('/api/v1/inventory/stock-items')
      .set(authHeader(admin.token))
      .query({
        warehouseId: master.warehouse.id,
        productId: master.product.id,
      })
      .expect(200);
    const body = apiEnvelope<StockItemData[]>(response.body);

    expect(body.data).toHaveLength(1);
    return body.data[0];
  }

  async function expectStock(
    master: MasterData,
    expected: Pick<
      StockItemData,
      'quantityOnHand' | 'quantityReserved' | 'availableQuantity'
    >,
  ): Promise<void> {
    await expect(getStockItem(master)).resolves.toMatchObject(expected);
  }

  async function listMovements(
    token: string,
    query: Record<string, string>,
  ): Promise<ApiResponse<StockMovementData[]>> {
    const response = await request(httpServer)
      .get('/api/v1/inventory/movements')
      .set(authHeader(token))
      .query(query)
      .expect(200);

    return apiEnvelope<StockMovementData[]>(response.body);
  }

  async function listCustomers(
    token: string,
    q: string,
  ): Promise<ApiResponse<CustomerData[]>> {
    const response = await request(httpServer)
      .get('/api/v1/customers')
      .set(authHeader(token))
      .query({ q })
      .expect(200);

    return apiEnvelope<CustomerData[]>(response.body);
  }

  async function listProducts(
    token: string,
    q: string,
  ): Promise<ApiResponse<ProductData[]>> {
    const response = await request(httpServer)
      .get('/api/v1/products')
      .set(authHeader(token))
      .query({ q })
      .expect(200);

    return apiEnvelope<ProductData[]>(response.body);
  }

  async function listWarehouses(
    token: string,
    q: string,
  ): Promise<ApiResponse<WarehouseData[]>> {
    const response = await request(httpServer)
      .get('/api/v1/warehouses')
      .set(authHeader(token))
      .query({ q })
      .expect(200);

    return apiEnvelope<WarehouseData[]>(response.body);
  }

  async function listSalesOrdersByCustomerId(
    token: string,
    customerId: string,
  ): Promise<ApiResponse<SalesOrderData[]>> {
    const response = await request(httpServer)
      .get('/api/v1/sales-orders')
      .set(authHeader(token))
      .query({ customerId })
      .expect(200);

    return apiEnvelope<SalesOrderData[]>(response.body);
  }

  async function listInvoicesBySalesOrderId(
    token: string,
    salesOrderId: string,
  ): Promise<ApiResponse<InvoiceData[]>> {
    const response = await request(httpServer)
      .get('/api/v1/invoices')
      .set(authHeader(token))
      .query({ salesOrderId })
      .expect(200);

    return apiEnvelope<InvoiceData[]>(response.body);
  }

  async function listPayments(
    token: string,
    invoiceId: string,
  ): Promise<ApiResponse<PaymentData[]>> {
    const response = await request(httpServer)
      .get('/api/v1/payments')
      .set(authHeader(token))
      .query({ invoiceId })
      .expect(200);

    return apiEnvelope<PaymentData[]>(response.body);
  }

  async function listAuditLogs(
    token: string,
    query: Record<string, number | string>,
  ): Promise<ApiResponse<AuditLogData[]>> {
    const response = await request(httpServer)
      .get('/api/v1/audit-logs')
      .set(authHeader(token))
      .query(query)
      .expect(200);

    return apiEnvelope<AuditLogData[]>(response.body);
  }

  async function expectForbidden(
    test: request.Test,
  ): Promise<void> {
    const response = await test;
    expect(response.status).toBe(403);
    expect(apiError(response.body).error.code).toBe(ErrorCode.FORBIDDEN);
  }

  async function expectNotFound(
    test: request.Test,
  ): Promise<void> {
    const response = await test;
    expect(response.status).toBe(404);
    expect(apiError(response.body).error.code).toBe(ErrorCode.NOT_FOUND);
  }

  function customerBody(suffix: string): Record<string, unknown> {
    return {
      code: `CUS-${suffix}`,
      name: `Customer ${suffix}`,
      phone: '0909123456',
      email: `customer-${suffix}@example.com`,
      taxCode: null,
      type: CustomerType.B2C,
    };
  }

  function productBody(suffix: string): Record<string, unknown> {
    return {
      sku: `SKU-${suffix}`,
      name: `Product ${suffix}`,
      unit: 'pcs',
      basePrice: '100000.00',
    };
  }

  function warehouseBody(suffix: string): Record<string, unknown> {
    return {
      code: `WH-${suffix}`,
      name: `Warehouse ${suffix}`,
      address: 'Ha Noi',
    };
  }

  function salesOrderBody(
    master: MasterData,
    quantity: number,
    unitPrice: string,
  ): Record<string, unknown> {
    return {
      customerId: master.customer.id,
      warehouseId: master.warehouse.id,
      discountAmount: '0.00',
      taxAmount: '0.00',
      note: 'E2E sales order',
      lines: [
        {
          productId: master.product.id,
          quantity,
          unitPrice,
        },
      ],
    };
  }

  function paymentBody(amount: string): Record<string, unknown> {
    return {
      amount,
      method: PaymentMethod.BANK_TRANSFER,
      referenceNo: `E2E-${Date.now()}`,
      paidAt: new Date().toISOString(),
    };
  }

  function authHeader(token: string): Record<string, string> {
    return { Authorization: `Bearer ${token}` };
  }

  function apiData<TData>(body: unknown): TData {
    return apiEnvelope<TData>(body).data;
  }

  function apiEnvelope<TData>(body: unknown): ApiResponse<TData> {
    return body as ApiResponse<TData>;
  }

  function apiError(body: unknown): ApiErrorResponse {
    return body as ApiErrorResponse;
  }

  function uniqueSuffix(scope: string): string {
    return `${scope}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
  }
});
