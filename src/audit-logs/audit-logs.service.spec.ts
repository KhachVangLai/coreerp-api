import { AuditAction } from './audit-action.constants';
import { AuditLogsService } from './audit-logs.service';

type MockPrisma = {
  $transaction: jest.Mock;
  auditLog: {
    count: jest.Mock;
    create: jest.Mock;
    findMany: jest.Mock;
  };
};

describe('AuditLogsService', () => {
  let prisma: MockPrisma;
  let service: AuditLogsService;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((operations: Promise<unknown>[]) =>
        Promise.all(operations),
      ),
      auditLog: {
        count: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };

    service = new AuditLogsService(prisma as never);
  });

  it('records sanitized metadata without sensitive secrets', async () => {
    prisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });

    await AuditLogsService.recordWithTx(prisma as never, {
      tenantId: 'tenant-1',
      actorUserId: 'user-1',
      action: AuditAction.USER_CREATED,
      entityType: 'User',
      entityId: 'user-2',
      metadata: {
        email: 'demo@example.com',
        password: '123456',
        passwordHash: 'hash',
        nested: {
          token: 'secret-token',
          role: 'SALES',
        },
      },
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1',
        actorUserId: 'user-1',
        action: AuditAction.USER_CREATED,
        entityType: 'User',
        entityId: 'user-2',
        metadata: {
          email: 'demo@example.com',
          nested: {
            role: 'SALES',
          },
        },
      },
      select: { id: true },
    });
  });

  it('lists only current tenant audit logs with actor email', async () => {
    const createdAt = new Date('2026-05-20T12:00:00.000Z');
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'audit-1',
        actorUserId: 'user-1',
        actor: { email: 'admin@minhanh.vn' },
        action: AuditAction.SALES_ORDER_CONFIRMED,
        entityType: 'SalesOrder',
        entityId: 'sales-order-1',
        metadata: { orderCode: 'SO-20260520-0001' },
        createdAt,
      },
    ]);
    prisma.auditLog.count.mockResolvedValue(1);

    const result = await service.listAuditLogs('tenant-1', {
      entityType: 'SalesOrder',
      entityId: 'sales-order-1',
      actorUserId: 'user-1',
      action: AuditAction.SALES_ORDER_CONFIRMED,
      page: 1,
      limit: 20,
    });

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-1',
          entityType: 'SalesOrder',
          entityId: 'sales-order-1',
          actorUserId: 'user-1',
          action: AuditAction.SALES_ORDER_CONFIRMED,
        },
        skip: 0,
        take: 20,
      }),
    );
    expect(result).toEqual({
      data: [
        {
          id: 'audit-1',
          actorUserId: 'user-1',
          actorEmail: 'admin@minhanh.vn',
          action: AuditAction.SALES_ORDER_CONFIRMED,
          entityType: 'SalesOrder',
          entityId: 'sales-order-1',
          metadata: { orderCode: 'SO-20260520-0001' },
          createdAt,
        },
      ],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      },
    });
  });
});
