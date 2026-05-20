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
import { AuditAction } from '../audit-logs/audit-action.constants';
import { PaymentsService } from './payments.service';

type MockPrisma = {
  $transaction: jest.Mock;
  auditLog: {
    create: jest.Mock;
  };
  invoice: {
    count: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  payment: {
    count: jest.Mock;
    create: jest.Mock;
    findMany: jest.Mock;
  };
  salesOrder: {
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

describe('PaymentsService', () => {
  let service: PaymentsService;
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

  const invoice = {
    id: 'invoice-1',
    invoiceCode: 'INV-20260520-0001',
    status: InvoiceStatus.ISSUED,
    totalAmount: decimal('600000.00'),
    paidAmount: decimal('0.00'),
    salesOrder: {
      id: 'sales-order-1',
      status: SalesOrderStatus.FULFILLED,
    },
  };

  const payment = {
    id: 'payment-1',
    invoiceId: invoice.id,
    amount: decimal('300000.00'),
    method: PaymentMethod.BANK_TRANSFER,
    referenceNo: 'VCB123456',
    paidAt: new Date('2026-05-16T10:00:00.000Z'),
    createdAt: new Date('2026-05-20T12:00:00.000Z'),
    invoice: {
      id: invoice.id,
      invoiceCode: invoice.invoiceCode,
      status: InvoiceStatus.PARTIALLY_PAID,
      totalAmount: decimal('600000.00'),
      paidAmount: decimal('300000.00'),
    },
  };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((input: unknown) => {
        if (Array.isArray(input)) {
          return Promise.all(input as Promise<unknown>[]);
        }

        return (input as (tx: MockPrisma) => Promise<unknown>)(prisma);
      }),
      auditLog: {
        create: jest.fn(),
      },
      invoice: {
        count: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      payment: {
        count: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      salesOrder: {
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

    prisma.invoice.findFirst.mockResolvedValue(invoice);
    prisma.payment.create.mockResolvedValue(payment);
    prisma.invoice.update.mockResolvedValue(payment.invoice);

    service = new PaymentsService(prisma as unknown as PrismaService);
  });

  it('allows TENANT_ADMIN to record partial payment for ISSUED invoice', async () => {
    const result = await service.recordPayment(admin, invoice.id, {
      amount: '300000.00',
      method: PaymentMethod.BANK_TRANSFER,
      referenceNo: 'VCB123456',
      paidAt: '2026-05-16T10:00:00.000Z',
    });

    expect(prisma.invoice.findFirst).toHaveBeenCalledWith({
      where: {
        id: invoice.id,
        tenantId: admin.tenantId,
      },
      select: expect.objectContaining({
        id: true,
        status: true,
        totalAmount: true,
        paidAmount: true,
      }),
    });
    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: admin.tenantId,
          invoiceId: invoice.id,
          amount: '300000.00',
          method: PaymentMethod.BANK_TRANSFER,
          referenceNo: 'VCB123456',
          paidAt: new Date('2026-05-16T10:00:00.000Z'),
          createdById: admin.userId,
        }),
      }),
    );
    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: invoice.id },
        data: {
          paidAmount: '300000.00',
          status: InvoiceStatus.PARTIALLY_PAID,
        },
      }),
    );
    expect(prisma.salesOrder.update).not.toHaveBeenCalled();
    expect(prisma.stockItem.update).not.toHaveBeenCalled();
    expect(prisma.stockMovement.create).not.toHaveBeenCalled();
    expect(prisma.stockReservation.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: AuditAction.PAYMENT_RECORDED,
          entityType: 'Payment',
          entityId: payment.id,
          metadata: expect.objectContaining({
            invoiceId: invoice.id,
            paymentAmount: '300000.00',
          }),
        }),
      }),
    );
    expect(result).toEqual({
      payment: {
        id: payment.id,
        invoiceId: invoice.id,
        amount: '300000.00',
        method: PaymentMethod.BANK_TRANSFER,
        referenceNo: 'VCB123456',
        paidAt: payment.paidAt,
        createdAt: payment.createdAt,
        invoice: {
          id: invoice.id,
          invoiceCode: invoice.invoiceCode,
          status: InvoiceStatus.PARTIALLY_PAID,
          totalAmount: '600000.00',
          paidAmount: '300000.00',
        },
      },
      invoice: {
        id: invoice.id,
        invoiceCode: invoice.invoiceCode,
        status: InvoiceStatus.PARTIALLY_PAID,
        totalAmount: '600000.00',
        paidAmount: '300000.00',
      },
      salesOrder: {
        id: invoice.salesOrder.id,
        status: SalesOrderStatus.FULFILLED,
      },
    });
  });

  it('allows FINANCE to record payment and defaults paidAt to now', async () => {
    await service.recordPayment(finance, invoice.id, {
      amount: '300000.00',
      method: PaymentMethod.CASH,
    });

    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: finance.tenantId,
          method: PaymentMethod.CASH,
          paidAt: expect.any(Date),
        }),
      }),
    );
  });

  it.each([InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED])(
    'rejects payment for %s invoice',
    async (status) => {
      prisma.invoice.findFirst.mockResolvedValue({
        ...invoice,
        status,
      });

      await expect(
        service.recordPayment(admin, invoice.id, {
          amount: '300000.00',
          method: PaymentMethod.CASH,
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: ErrorCode.CONFLICT }),
        status: HttpStatus.CONFLICT,
      });
      expect(prisma.payment.create).not.toHaveBeenCalled();
    },
  );

  it('rejects payment for PAID invoice', async () => {
    prisma.invoice.findFirst.mockResolvedValue({
      ...invoice,
      status: InvoiceStatus.PAID,
    });

    await expect(
      service.recordPayment(admin, invoice.id, {
        amount: '300000.00',
        method: PaymentMethod.CASH,
      }),
    ).rejects.toMatchObject({
      response: {
        code: ErrorCode.CONFLICT,
        message: 'Invoice is already paid',
      },
      status: HttpStatus.CONFLICT,
    });
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('rejects amount greater than remaining with PAYMENT_EXCEEDS_REMAINING', async () => {
    prisma.invoice.findFirst.mockResolvedValue({
      ...invoice,
      paidAmount: decimal('500000.00'),
    });

    await expect(
      service.recordPayment(admin, invoice.id, {
        amount: '200000.00',
        method: PaymentMethod.CASH,
      }),
    ).rejects.toMatchObject({
      response: {
        code: ErrorCode.PAYMENT_EXCEEDS_REMAINING,
        message: 'Payment amount exceeds remaining invoice amount',
        details: {
          amount: '200000.00',
          remainingAmount: '100000.00',
        },
      },
      status: HttpStatus.CONFLICT,
    });
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('records full payment and completes fulfilled sales order', async () => {
    prisma.payment.create.mockResolvedValue({
      ...payment,
      amount: decimal('600000.00'),
      invoice: {
        ...payment.invoice,
        status: InvoiceStatus.PAID,
        paidAmount: decimal('600000.00'),
      },
    });
    prisma.invoice.update.mockResolvedValue({
      ...payment.invoice,
      status: InvoiceStatus.PAID,
      paidAmount: decimal('600000.00'),
    });
    prisma.salesOrder.update.mockResolvedValue({
      id: invoice.salesOrder.id,
      status: SalesOrderStatus.COMPLETED,
    });

    const result = await service.recordPayment(admin, invoice.id, {
      amount: '600000.00',
      method: PaymentMethod.BANK_TRANSFER,
    });

    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          paidAmount: '600000.00',
          status: InvoiceStatus.PAID,
        },
      }),
    );
    expect(prisma.salesOrder.update).toHaveBeenCalledWith({
      where: { id: invoice.salesOrder.id },
      data: {
        status: SalesOrderStatus.COMPLETED,
        completedById: admin.userId,
        completedAt: expect.any(Date),
      },
      select: {
        id: true,
        status: true,
      },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: AuditAction.SALES_ORDER_COMPLETED,
          entityType: 'SalesOrder',
          entityId: invoice.salesOrder.id,
        }),
      }),
    );
    expect(result.invoice.status).toBe(InvoiceStatus.PAID);
    expect(result.salesOrder.status).toBe(SalesOrderStatus.COMPLETED);
  });

  it('does not complete sales order if it is not FULFILLED', async () => {
    prisma.invoice.findFirst.mockResolvedValue({
      ...invoice,
      salesOrder: {
        id: invoice.salesOrder.id,
        status: SalesOrderStatus.CANCELLED,
      },
    });
    prisma.payment.create.mockResolvedValue({
      ...payment,
      amount: decimal('600000.00'),
      invoice: {
        ...payment.invoice,
        status: InvoiceStatus.PAID,
        paidAmount: decimal('600000.00'),
      },
    });
    prisma.invoice.update.mockResolvedValue({
      ...payment.invoice,
      status: InvoiceStatus.PAID,
      paidAmount: decimal('600000.00'),
    });

    const result = await service.recordPayment(admin, invoice.id, {
      amount: '600000.00',
      method: PaymentMethod.CASH,
    });

    expect(prisma.salesOrder.update).not.toHaveBeenCalled();
    expect(result.salesOrder.status).toBe(SalesOrderStatus.CANCELLED);
  });

  it('returns NOT_FOUND for cross-tenant invoice', async () => {
    prisma.invoice.findFirst.mockResolvedValue(null);

    await expect(
      service.recordPayment(admin, 'tenant-b-invoice', {
        amount: '300000.00',
        method: PaymentMethod.CASH,
      }),
    ).rejects.toMatchObject({
      response: { code: ErrorCode.NOT_FOUND, message: 'Invoice not found' },
      status: HttpStatus.NOT_FOUND,
    });
  });

  it('lists only current tenant payments with filters and pagination metadata', async () => {
    prisma.payment.findMany.mockResolvedValue([payment]);
    prisma.payment.count.mockResolvedValue(1);

    const result = await service.listPayments(admin, {
      invoiceId: invoice.id,
      method: PaymentMethod.BANK_TRANSFER,
      fromDate: '2026-05-01T00:00:00.000Z',
      toDate: '2026-05-31T23:59:59.999Z',
      page: 1,
      limit: 20,
    });

    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: admin.tenantId,
          invoiceId: invoice.id,
          method: PaymentMethod.BANK_TRANSFER,
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
    expect(result.data[0].invoice?.id).toBe(invoice.id);
  });
});
