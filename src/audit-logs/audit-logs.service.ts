import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import {
  createPaginationMeta,
  getPaginationSkip,
} from '../common/pagination/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditActionValue } from './audit-action.constants';
import {
  AuditLogResponseDto,
  PaginatedAuditLogResponseDto,
} from './dto/audit-log-response.dto';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';

type AuditRecordParams = {
  tenantId: string;
  actorUserId?: string | null;
  action: AuditActionValue | string;
  entityType: string;
  entityId: string;
  metadata?: unknown;
};

type AuditWritable = {
  auditLog?: {
    create: (args: {
      data: {
        tenantId: string;
        actorUserId?: string | null;
        action: string;
        entityType: string;
        entityId: string;
        metadata?: Prisma.InputJsonValue;
      };
      select: { id: true };
    }) => Promise<{ id: string }>;
  };
};

const AUDIT_LOG_SELECT = {
  id: true,
  actorUserId: true,
  action: true,
  entityType: true,
  entityId: true,
  metadata: true,
  createdAt: true,
  actor: {
    select: {
      email: true,
    },
  },
} satisfies Prisma.AuditLogSelect;

type AuditLogRecord = Prisma.AuditLogGetPayload<{
  select: typeof AUDIT_LOG_SELECT;
}>;

const SENSITIVE_KEY_PATTERN = /(password|passwordHash|secret|token|authorization)/i;

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  static async recordWithTx(
    tx: Prisma.TransactionClient | PrismaService | AuditWritable,
    params: AuditRecordParams,
  ): Promise<void> {
    const writable = tx as AuditWritable;

    if (!writable.auditLog?.create) {
      return;
    }

    await writable.auditLog.create({
      data: {
        tenantId: params.tenantId,
        actorUserId: params.actorUserId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: sanitizeMetadata(params.metadata),
      },
      select: { id: true },
    });
  }

  async record(params: AuditRecordParams): Promise<void> {
    await AuditLogsService.recordWithTx(this.prisma, params);
  }

  async listAuditLogs(
    tenantId: string,
    query: ListAuditLogsQueryDto,
  ): Promise<PaginatedAuditLogResponseDto> {
    const page = query.page;
    const limit = query.limit;
    const where: Prisma.AuditLogWhereInput = {
      tenantId,
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
      ...(query.action ? { action: query.action } : {}),
    };

    const [logs, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        select: AUDIT_LOG_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: getPaginationSkip(page, limit),
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs.map((log) => this.toResponse(log)),
      meta: createPaginationMeta(total, page, limit),
    };
  }

  private toResponse(log: AuditLogRecord): AuditLogResponseDto {
    return {
      id: log.id,
      actorUserId: log.actorUserId,
      actorEmail: log.actor?.email ?? null,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      metadata: log.metadata ?? {},
      createdAt: log.createdAt,
    };
  }
}

function sanitizeMetadata(metadata: unknown): Prisma.InputJsonValue {
  if (metadata === undefined || metadata === null) {
    return {};
  }

  if (metadata instanceof Date) {
    return metadata.toISOString();
  }

  if (Array.isArray(metadata)) {
    return metadata.map((item) => sanitizeMetadata(item)) as Prisma.InputJsonValue;
  }

  if (typeof metadata === 'object') {
    return Object.fromEntries(
      Object.entries(metadata as Record<string, unknown>)
        .filter(([key]) => !SENSITIVE_KEY_PATTERN.test(key))
        .map(([key, value]) => [key, sanitizeMetadata(value)]),
    ) as Prisma.InputJsonValue;
  }

  if (
    typeof metadata === 'string' ||
    typeof metadata === 'number' ||
    typeof metadata === 'boolean'
  ) {
    return metadata;
  }

  return String(metadata);
}
