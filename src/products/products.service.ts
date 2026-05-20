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
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import {
  PaginatedProductResponseDto,
  ProductResponseDto,
} from './dto/product-response.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const PRODUCT_SAFE_SELECT = {
  id: true,
  sku: true,
  name: true,
  unit: true,
  basePrice: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProductSelect;

type ProductRecord = Prisma.ProductGetPayload<{
  select: typeof PRODUCT_SAFE_SELECT;
}>;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async createProduct(
    currentUser: AuthenticatedUser,
    dto: CreateProductDto,
  ): Promise<ProductResponseDto> {
    const existingProduct = await this.prisma.product.findUnique({
      where: {
        tenantId_sku: {
          tenantId: currentUser.tenantId,
          sku: dto.sku,
        },
      },
      select: { id: true },
    });

    if (existingProduct) {
      throw new BusinessException(
        ErrorCode.DUPLICATE_RESOURCE,
        'Product SKU already exists in this tenant',
        HttpStatus.CONFLICT,
        { sku: dto.sku },
      );
    }

    const product = await this.prisma.product.create({
      data: {
        tenantId: currentUser.tenantId,
        sku: dto.sku,
        name: dto.name,
        unit: dto.unit,
        basePrice: dto.basePrice,
      },
      select: PRODUCT_SAFE_SELECT,
    });

    await AuditLogsService.recordWithTx(this.prisma, {
      tenantId: currentUser.tenantId,
      actorUserId: currentUser.userId,
      action: AuditAction.PRODUCT_CREATED,
      entityType: 'Product',
      entityId: product.id,
      metadata: {
        sku: product.sku,
        name: product.name,
        status: product.status,
      },
    });

    return this.toResponse(product);
  }

  async listProducts(
    currentUser: AuthenticatedUser,
    query: ListProductsQueryDto,
  ): Promise<PaginatedProductResponseDto> {
    const page = query.page;
    const limit = query.limit;
    const where: Prisma.ProductWhereInput = {
      tenantId: currentUser.tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { sku: { contains: query.q, mode: Prisma.QueryMode.insensitive } },
              { name: { contains: query.q, mode: Prisma.QueryMode.insensitive } },
            ],
          }
        : {}),
    };

    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        select: PRODUCT_SAFE_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: getPaginationSkip(page, limit),
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products.map((product) => this.toResponse(product)),
      meta: createPaginationMeta(total, page, limit),
    };
  }

  async getProduct(
    currentUser: AuthenticatedUser,
    id: string,
  ): Promise<ProductResponseDto> {
    const product = await this.prisma.product.findFirst({
      where: {
        id,
        tenantId: currentUser.tenantId,
      },
      select: PRODUCT_SAFE_SELECT,
    });

    if (!product) {
      throw this.notFound();
    }

    return this.toResponse(product);
  }

  async updateProduct(
    currentUser: AuthenticatedUser,
    id: string,
    dto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    const targetProduct = await this.prisma.product.findFirst({
      where: {
        id,
        tenantId: currentUser.tenantId,
      },
      select: { id: true },
    });

    if (!targetProduct) {
      throw this.notFound();
    }

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        unit: dto.unit,
        basePrice: dto.basePrice,
        status: dto.status,
      },
      select: PRODUCT_SAFE_SELECT,
    });

    await AuditLogsService.recordWithTx(this.prisma, {
      tenantId: currentUser.tenantId,
      actorUserId: currentUser.userId,
      action: AuditAction.PRODUCT_UPDATED,
      entityType: 'Product',
      entityId: product.id,
      metadata: {
        sku: product.sku,
        status: product.status,
      },
    });

    return this.toResponse(product);
  }

  private toResponse(product: ProductRecord): ProductResponseDto {
    return {
      ...product,
      basePrice: product.basePrice.toFixed(2),
    };
  }

  private notFound(): BusinessException {
    return new BusinessException(
      ErrorCode.NOT_FOUND,
      'Product not found',
      HttpStatus.NOT_FOUND,
    );
  }
}
