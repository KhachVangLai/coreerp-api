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
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ListCustomersQueryDto } from './dto/list-customers-query.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import {
  CustomerResponseDto,
  PaginatedCustomerResponseDto,
} from './dto/customer-response.dto';

const CUSTOMER_SAFE_SELECT = {
  id: true,
  code: true,
  name: true,
  phone: true,
  email: true,
  taxCode: true,
  type: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CustomerSelect;

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async createCustomer(
    currentUser: AuthenticatedUser,
    dto: CreateCustomerDto,
  ): Promise<CustomerResponseDto> {
    const existingCustomer = await this.prisma.customer.findUnique({
      where: {
        tenantId_code: {
          tenantId: currentUser.tenantId,
          code: dto.code,
        },
      },
      select: { id: true },
    });

    if (existingCustomer) {
      throw new BusinessException(
        ErrorCode.DUPLICATE_RESOURCE,
        'Customer code already exists in this tenant',
        HttpStatus.CONFLICT,
        { code: dto.code },
      );
    }

    const customer = await this.prisma.customer.create({
      data: {
        tenantId: currentUser.tenantId,
        code: dto.code,
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        taxCode: dto.taxCode,
        type: dto.type,
      },
      select: CUSTOMER_SAFE_SELECT,
    });

    await AuditLogsService.recordWithTx(this.prisma, {
      tenantId: currentUser.tenantId,
      actorUserId: currentUser.userId,
      action: AuditAction.CUSTOMER_CREATED,
      entityType: 'Customer',
      entityId: customer.id,
      metadata: {
        code: customer.code,
        name: customer.name,
        type: customer.type,
      },
    });

    return customer;
  }

  async listCustomers(
    currentUser: AuthenticatedUser,
    query: ListCustomersQueryDto,
  ): Promise<PaginatedCustomerResponseDto> {
    const page = query.page;
    const limit = query.limit;
    const where: Prisma.CustomerWhereInput = {
      tenantId: currentUser.tenantId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { code: { contains: query.q, mode: Prisma.QueryMode.insensitive } },
              { name: { contains: query.q, mode: Prisma.QueryMode.insensitive } },
              { phone: { contains: query.q, mode: Prisma.QueryMode.insensitive } },
              { email: { contains: query.q, mode: Prisma.QueryMode.insensitive } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        select: CUSTOMER_SAFE_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: getPaginationSkip(page, limit),
        take: limit,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      data,
      meta: createPaginationMeta(total, page, limit),
    };
  }

  async getCustomer(
    currentUser: AuthenticatedUser,
    id: string,
  ): Promise<CustomerResponseDto> {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id,
        tenantId: currentUser.tenantId,
      },
      select: CUSTOMER_SAFE_SELECT,
    });

    if (!customer) {
      throw this.notFound();
    }

    return customer;
  }

  async updateCustomer(
    currentUser: AuthenticatedUser,
    id: string,
    dto: UpdateCustomerDto,
  ): Promise<CustomerResponseDto> {
    const targetCustomer = await this.prisma.customer.findFirst({
      where: {
        id,
        tenantId: currentUser.tenantId,
      },
      select: { id: true },
    });

    if (!targetCustomer) {
      throw this.notFound();
    }

    const customer = await this.prisma.customer.update({
      where: { id },
      data: {
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        taxCode: dto.taxCode,
        type: dto.type,
        status: dto.status,
      },
      select: CUSTOMER_SAFE_SELECT,
    });

    await AuditLogsService.recordWithTx(this.prisma, {
      tenantId: currentUser.tenantId,
      actorUserId: currentUser.userId,
      action: AuditAction.CUSTOMER_UPDATED,
      entityType: 'Customer',
      entityId: customer.id,
      metadata: {
        code: customer.code,
        status: customer.status,
      },
    });

    return customer;
  }

  private notFound(): BusinessException {
    return new BusinessException(
      ErrorCode.NOT_FOUND,
      'Customer not found',
      HttpStatus.NOT_FOUND,
    );
  }
}
