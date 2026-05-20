import { HttpStatus } from '@nestjs/common';
import {
  InvoiceStatus,
  PaymentMethod,
  SalesOrderStatus,
  UserRole,
} from '@prisma/client';

import { AuthenticatedUser } from '../auth/types/auth-user.type';
import { ErrorCode } from '../common/errors/error-code.enum';
import { PrismaService } from '../prisma/prisma.service';
import { InvoicesService } from './invoices.service';

type MockPrisma = {
  $transaction: jest.Mock;
  invoice: {
    count: jest.Mock;
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
  payment: {
    create: jest.Mock;
  };
  salesOrder: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  stockItem: {
    update: jest.Mock;
  };
  stockMovement: {
    create: jest.Mock;
  };
  stockReservation: {
    update: jest.Mock;
  };
};

const decimal = (value: string) => ({
  toFixed: () => value,
});

describe('InvoicesService', () => {
  let service: InvoicesService;
  let prisma: MockPrisma;

  const admin: AuthenticatedUser = {
    sub: 'admin-1',
    userId: 'admin-1',
    tenantId: 'tenant-1',
    role: UserRole.TENANT_ADMIN,
  };

  const finance: AuthenticatedUser = {
    ...admin,
    sub: 'finance-1',
    userId: 'finance-1',
    role: UserRole.FINANCE,
  };

  const salesOrderLine = {
    productId: 'product-1',
    skuSnapshot: 'SP001',
    productNameSnapshot: 'Ao thun trang',
    unitSnapshot: 'pcs',
    quantity: 5,
    unitPrice: decimal('120000.00'),
    lineTotal: decimal('600000.00'),
  };

  const fulfilledSalesOrder = {
    id: 'sales-order-1',
    customerId: 'customer-1',
    status: SalesOrderStatus.FULFILLED,
    subtotalAmount: decimal('600000.00'),
    discountAmount: decimal('0.00'),
    taxAmount: decimal('0.00'),
    totalAmount: decimal('600000.00'),
    invoice: null,
    lines: [salesOrderLine],
  };

  const invoice = {
    id: 'invoice-1',
    invoiceCode: 'INV-20260520-0001',
    salesOrderId: fulfilledSalesOrder.id,
    customerId: fulfilledSalesOrder.customerId,
    status: InvoiceStatus.DRAFT,
    subtotalAmount: decimal('600000.00'),
    discountAmount: decimal('0.00'),
    taxAmount: decimal('0.00'),
    totalAmount: decimal('600000.00'),
    paidAmount: decimal('0.00'),
    issuedAt: null,
    createdAt: new Date('2026-05-20T12:00:00.000Z'),
    updatedAt: new Date('2026-05-20T12:00:00.000Z'),
    lines: [
      {
        id: 'invoice-line-1',
        ...salesOrderLine,
      },
    ],
    customer: {
      id: 'customer-1',
      code: 'CUS001',
      name: 'Nguyen Van A',
    },
    salesOrder: {
      id: 'sales-order-1',
      orderCode: 'SO-20260520-0001',
    },
    payments: [],
  };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((input: unknown) => {
        if (Array.isArray(input)) {
          return Promise.all(input as Promise<unknown>[]);
        }

        return (input as (tx: MockPrisma) => Promise<unknown>)(prisma);
      }),
      invoice: {
        count: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      payment: {
        create: jest.fn(),
      },
      salesOrder: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      stockItem: {
        update: jest.fn(),
      },
      stockMovement: {
        create: jest.fn(),
      },
      stockReservation: {
        update: jest.fn(),
      },
    };

    prisma.invoice.count.mockResolvedValue(0);
    prisma.salesOrder.findFirst.mockResolvedValue(fulfilledSalesOrder);
    prisma.invoice.create.mockResolvedValue(invoice);

    service = new InvoicesService(prisma as unknown as PrismaService);
  });

  it('allows TENANT_ADMIN to generate invoice from FULFILLED order with snapshots', async () => {
    const result = await service.generateFromSalesOrder(
      admin,
      fulfilledSalesOrder.id,
      { note: 'Generate invoice after fulfillment' },
    );

    expect(prisma.salesOrder.findFirst).toHaveBeenCalledWith({
      where: {
        id: fulfilledSalesOrder.id,
        tenantId: admin.tenantId,
      },
      select: expect.objectContaining({
        id: true,
        customerId: true,
        status: true,
      }),
    });
    expect(prisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: admin.tenantId,
          salesOrderId: fulfilledSalesOrder.id,
          customerId: fulfilledSalesOrder.customerId,
          invoiceCode: expect.stringMatching(/^INV-\d{8}-0001$/),
          status: InvoiceStatus.DRAFT,
          subtotalAmount: fulfilledSalesOrder.subtotalAmount,
          discountAmount: fulfilledSalesOrder.discountAmount,
          taxAmount: fulfilledSalesOrder.taxAmount,
          totalAmount: fulfilledSalesOrder.totalAmount,
          paidAmount: '0.00',
          lines: {
            create: [
              expect.objectContaining({
                tenantId: admin.tenantId,
                productId: salesOrderLine.productId,
                skuSnapshot: salesOrderLine.skuSnapshot,
                productNameSnapshot: salesOrderLine.productNameSnapshot,
                unitSnapshot: salesOrderLine.unitSnapshot,
                quantity: salesOrderLine.quantity,
                unitPrice: salesOrderLine.unitPrice,
                lineTotal: salesOrderLine.lineTotal,
              }),
            ],
          },
        }),
      }),
    );
    expect(prisma.stockItem.update).not.toHaveBeenCalled();
    expect(prisma.stockMovement.create).not.toHaveBeenCalled();
    expect(prisma.stockReservation.update).not.toHaveBeenCalled();
    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(prisma.salesOrder.update).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      id: invoice.id,
      status: InvoiceStatus.DRAFT,
      subtotalAmount: '600000.00',
      paidAmount: '0.00',
      lines: [
        expect.objectContaining({
          skuSnapshot: salesOrderLine.skuSnapshot,
          productNameSnapshot: salesOrderLine.productNameSnapshot,
          unitSnapshot: salesOrderLine.unitSnapshot,
          unitPrice: '120000.00',
          lineTotal: '600000.00',
        }),
      ],
    });
    expect(JSON.stringify(result)).not.toContain('tenantId');
  });

  it('allows FINANCE to generate invoice from FULFILLED order', async () => {
    await service.generateFromSalesOrder(finance, fulfilledSalesOrder.id, {});

    expect(prisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: finance.tenantId }),
      }),
    );
  });

  it.each([
    SalesOrderStatus.DRAFT,
    SalesOrderStatus.CONFIRMED,
    SalesOrderStatus.CANCELLED,
  ])('rejects invoice generation from %s sales order', async (status) => {
    prisma.salesOrder.findFirst.mockResolvedValue({
      ...fulfilledSalesOrder,
      status,
    });

    await expect(
      service.generateFromSalesOrder(admin, fulfilledSalesOrder.id, {}),
    ).rejects.toMatchObject({
      response: {
        code: ErrorCode.INVALID_ORDER_STATUS,
        message: 'Only FULFILLED sales orders can be invoiced',
      },
      status: HttpStatus.CONFLICT,
    });
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  it('returns NOT_FOUND for cross-tenant sales order', async () => {
    prisma.salesOrder.findFirst.mockResolvedValue(null);

    await expect(
      service.generateFromSalesOrder(admin, 'tenant-b-sales-order', {}),
    ).rejects.toMatchObject({
      response: { code: ErrorCode.NOT_FOUND, message: 'Sales order not found' },
      status: HttpStatus.NOT_FOUND,
    });
  });

  it('rejects duplicate invoice for the same sales order', async () => {
    prisma.salesOrder.findFirst.mockResolvedValue({
      ...fulfilledSalesOrder,
      invoice: { id: invoice.id },
    });

    await expect(
      service.generateFromSalesOrder(admin, fulfilledSalesOrder.id, {}),
    ).rejects.toMatchObject({
      response: {
        code: ErrorCode.CONFLICT,
        message: 'Invoice already exists for this sales order',
      },
      status: HttpStatus.CONFLICT,
    });
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  it('keeps invoice line snapshots independent from later product changes', async () => {
    await service.generateFromSalesOrder(admin, fulfilledSalesOrder.id, {});
    const createArgs = prisma.invoice.create.mock.calls[0][0] as {
      data: {
        lines: {
          create: Array<{
            skuSnapshot: string;
            productNameSnapshot: string;
            unitSnapshot: string;
          }>;
        };
      };
    };

    expect(createArgs.data.lines.create[0]).toMatchObject({
      skuSnapshot: 'SP001',
      productNameSnapshot: 'Ao thun trang',
      unitSnapshot: 'pcs',
    });
  });

  it('issues a DRAFT invoice without payment/order/stock side effects', async () => {
    const issuedAt = new Date('2026-05-20T13:00:00.000Z');
    prisma.invoice.findFirst.mockResolvedValue({
      id: invoice.id,
      status: InvoiceStatus.DRAFT,
    });
    prisma.invoice.update.mockResolvedValue({
      ...invoice,
      status: InvoiceStatus.ISSUED,
      issuedAt,
    });

    const result = await service.issueInvoice(admin, invoice.id, {
      note: 'Issued to customer',
    });

    expect(prisma.invoice.findFirst).toHaveBeenCalledWith({
      where: {
        id: invoice.id,
        tenantId: admin.tenantId,
      },
      select: {
        id: true,
        status: true,
      },
    });
    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: invoice.id },
        data: expect.objectContaining({
          status: InvoiceStatus.ISSUED,
          issuedAt: expect.any(Date),
        }),
      }),
    );
    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(prisma.salesOrder.update).not.toHaveBeenCalled();
    expect(prisma.stockItem.update).not.toHaveBeenCalled();
    expect(result.status).toBe(InvoiceStatus.ISSUED);
    expect(result.issuedAt).toBe(issuedAt);
  });

  it('rejects issuing non-DRAFT invoice', async () => {
    prisma.invoice.findFirst.mockResolvedValue({
      id: invoice.id,
      status: InvoiceStatus.ISSUED,
    });

    await expect(service.issueInvoice(admin, invoice.id, {})).rejects.toMatchObject({
      response: {
        code: ErrorCode.CONFLICT,
        message: 'Only DRAFT invoices can be issued',
      },
      status: HttpStatus.CONFLICT,
    });
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it('lists only current tenant invoices with pagination metadata', async () => {
    prisma.invoice.findMany.mockResolvedValue([invoice]);
    prisma.invoice.count.mockResolvedValue(1);

    const result = await service.listInvoices(admin, {
      status: InvoiceStatus.DRAFT,
      customerId: invoice.customerId,
      salesOrderId: invoice.salesOrderId,
      q: 'INV-',
      page: 1,
      limit: 20,
    });

    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: admin.tenantId,
          status: InvoiceStatus.DRAFT,
          customerId: invoice.customerId,
          salesOrderId: invoice.salesOrderId,
        }),
        skip: 0,
        take: 20,
      }),
    );
    expect(result.meta).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
    expect(result.data[0]).toMatchObject({ invoiceCode: invoice.invoiceCode });
  });

  it('gets invoice detail with payment summaries', async () => {
    prisma.invoice.findFirst.mockResolvedValue({
      ...invoice,
      payments: [
        {
          id: 'payment-1',
          amount: decimal('100000.00'),
          method: PaymentMethod.CASH,
          referenceNo: null,
          paidAt: new Date('2026-05-20T14:00:00.000Z'),
        },
      ],
    });

    const result = await service.getInvoice(admin, invoice.id);

    expect(prisma.invoice.findFirst).toHaveBeenCalledWith({
      where: {
        id: invoice.id,
        tenantId: admin.tenantId,
      },
      select: expect.any(Object),
    });
    expect(result.payments).toEqual([
      {
        id: 'payment-1',
        amount: '100000.00',
        method: PaymentMethod.CASH,
        referenceNo: null,
        paidAt: new Date('2026-05-20T14:00:00.000Z'),
      },
    ]);
  });

  it('blocks cross-tenant invoice detail with NOT_FOUND', async () => {
    prisma.invoice.findFirst.mockResolvedValue(null);

    await expect(service.getInvoice(admin, 'tenant-b-invoice')).rejects.toMatchObject(
      {
        response: { code: ErrorCode.NOT_FOUND, message: 'Invoice not found' },
        status: HttpStatus.NOT_FOUND,
      },
    );
  });
});
