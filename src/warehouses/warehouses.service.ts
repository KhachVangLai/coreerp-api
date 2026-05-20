import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditAction } from '../audit-logs/audit-action.constants';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuthenticatedUser } from '../auth/types/auth-user.type';
import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-code.enum';
import {
  createPaginationMeta,
  getPaginationSkip,
} from '../common/pagination/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { ListWarehousesQueryDto } from './dto/list-warehouses-query.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import {
  PaginatedWarehouseResponseDto,
  WarehouseResponseDto,
} from './dto/warehouse-response.dto';

const WAREHOUSE_SAFE_SELECT = {
  id: true,
  code: true,
  name: true,
  address: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.WarehouseSelect;

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  async createWarehouse(
    currentUser: AuthenticatedUser,
    dto: CreateWarehouseDto,
  ): Promise<WarehouseResponseDto> {
    const existingWarehouse = await this.prisma.warehouse.findUnique({
      where: {
        tenantId_code: {
          tenantId: currentUser.tenantId,
          code: dto.code,
        },
      },
      select: { id: true },
    });

    if (existingWarehouse) {
      throw new BusinessException(
        ErrorCode.DUPLICATE_RESOURCE,
        'Warehouse code already exists in this tenant',
        HttpStatus.CONFLICT,
        { code: dto.code },
      );
    }

    const warehouse = await this.prisma.warehouse.create({
      data: {
        tenantId: currentUser.tenantId,
        code: dto.code,
        name: dto.name,
        address: dto.address,
      },
      select: WAREHOUSE_SAFE_SELECT,
    });

    await AuditLogsService.recordWithTx(this.prisma, {
      tenantId: currentUser.tenantId,
      actorUserId: currentUser.userId,
      action: AuditAction.WAREHOUSE_CREATED,
      entityType: 'Warehouse',
      entityId: warehouse.id,
      metadata: {
        code: warehouse.code,
        name: warehouse.name,
        isActive: warehouse.isActive,
      },
    });

    return warehouse;
  }

  async listWarehouses(
    currentUser: AuthenticatedUser,
    query: ListWarehousesQueryDto,
  ): Promise<PaginatedWarehouseResponseDto> {
    const page = query.page;
    const limit = query.limit;
    const where: Prisma.WarehouseWhereInput = {
      tenantId: currentUser.tenantId,
      ...(typeof query.isActive === 'boolean' ? { isActive: query.isActive } : {}),
      ...(query.q
        ? {
            OR: [
              { code: { contains: query.q, mode: Prisma.QueryMode.insensitive } },
              { name: { contains: query.q, mode: Prisma.QueryMode.insensitive } },
              {
                address: {
                  contains: query.q,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.warehouse.findMany({
        where,
        select: WAREHOUSE_SAFE_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: getPaginationSkip(page, limit),
        take: limit,
      }),
      this.prisma.warehouse.count({ where }),
    ]);

    return {
      data,
      meta: createPaginationMeta(total, page, limit),
    };
  }

  async getWarehouse(
    currentUser: AuthenticatedUser,
    id: string,
  ): Promise<WarehouseResponseDto> {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: {
        id,
        tenantId: currentUser.tenantId,
      },
      select: WAREHOUSE_SAFE_SELECT,
    });

    if (!warehouse) {
      throw this.notFound();
    }

    return warehouse;
  }

  async updateWarehouse(
    currentUser: AuthenticatedUser,
    id: string,
    dto: UpdateWarehouseDto,
  ): Promise<WarehouseResponseDto> {
    const targetWarehouse = await this.prisma.warehouse.findFirst({
      where: {
        id,
        tenantId: currentUser.tenantId,
      },
      select: { id: true },
    });

    if (!targetWarehouse) {
      throw this.notFound();
    }

    const warehouse = await this.prisma.warehouse.update({
      where: { id },
      data: {
        name: dto.name,
        address: dto.address,
        isActive: dto.isActive,
      },
      select: WAREHOUSE_SAFE_SELECT,
    });

    await AuditLogsService.recordWithTx(this.prisma, {
      tenantId: currentUser.tenantId,
      actorUserId: currentUser.userId,
      action: AuditAction.WAREHOUSE_UPDATED,
      entityType: 'Warehouse',
      entityId: warehouse.id,
      metadata: {
        code: warehouse.code,
        isActive: warehouse.isActive,
      },
    });

    return warehouse;
  }

  private notFound(): BusinessException {
    return new BusinessException(
      ErrorCode.NOT_FOUND,
      'Warehouse not found',
      HttpStatus.NOT_FOUND,
    );
  }
}
