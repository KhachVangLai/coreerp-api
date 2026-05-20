import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types/auth-user.type';
import { ApiErrorResponseDto } from '../common/dto/api-error-response.dto';
import { ApiSuccessResponseDto } from '../common/dto/api-success-response.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { ListStockItemsQueryDto } from './dto/list-stock-items-query.dto';
import { ListStockMovementsQueryDto } from './dto/list-stock-movements-query.dto';
import { ReceiveStockDto } from './dto/receive-stock.dto';
import {
  PaginatedStockItemResponseDto,
  StockItemResponseDto,
  StockItemsPaginationMetaDto,
} from './dto/stock-item-response.dto';
import {
  PaginatedStockMovementResponseDto,
  StockMovementResponseDto,
  StockMovementsPaginationMetaDto,
} from './dto/stock-movement-response.dto';
import { StockOperationResponseDto } from './dto/stock-operation-response.dto';
import { InventoryService } from './inventory.service';

const INVENTORY_READ_ROLES = [
  UserRole.TENANT_ADMIN,
  UserRole.SALES,
  UserRole.WAREHOUSE,
  UserRole.FINANCE,
  UserRole.VIEWER,
];

const INVENTORY_WRITE_ROLES = [UserRole.TENANT_ADMIN, UserRole.WAREHOUSE];

const MOVEMENT_READ_ROLES = [
  UserRole.TENANT_ADMIN,
  UserRole.WAREHOUSE,
  UserRole.FINANCE,
  UserRole.VIEWER,
];

@ApiTags('Inventory')
@ApiBearerAuth('bearer')
@ApiExtraModels(
  ApiSuccessResponseDto,
  ApiErrorResponseDto,
  StockItemResponseDto,
  StockItemsPaginationMetaDto,
  PaginatedStockItemResponseDto,
  StockOperationResponseDto,
  StockMovementResponseDto,
  StockMovementsPaginationMetaDto,
  PaginatedStockMovementResponseDto,
)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('stock-items')
  @Roles(...INVENTORY_READ_ROLES)
  @ApiOkResponse({
    description: 'Stock items listed',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiSuccessResponseDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(StockItemResponseDto) },
            },
            meta: { $ref: getSchemaPath(StockItemsPaginationMetaDto) },
          },
        },
      ],
    },
  })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  listStockItems(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: ListStockItemsQueryDto,
  ): Promise<PaginatedStockItemResponseDto> {
    return this.inventoryService.listStockItems(currentUser, query);
  }

  @Post('receipts')
  @Roles(...INVENTORY_WRITE_ROLES)
  @ApiCreatedResponse({
    description: 'Stock receipt created',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiSuccessResponseDto) },
        {
          properties: {
            data: { $ref: getSchemaPath(StockOperationResponseDto) },
          },
        },
      ],
    },
  })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  receiveStock(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: ReceiveStockDto,
  ): Promise<StockOperationResponseDto> {
    return this.inventoryService.receiveStock(currentUser, dto);
  }

  @Post('adjustments')
  @Roles(...INVENTORY_WRITE_ROLES)
  @ApiCreatedResponse({
    description: 'Stock adjustment created',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiSuccessResponseDto) },
        {
          properties: {
            data: { $ref: getSchemaPath(StockOperationResponseDto) },
          },
        },
      ],
    },
  })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  adjustStock(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: AdjustStockDto,
  ): Promise<StockOperationResponseDto> {
    return this.inventoryService.adjustStock(currentUser, dto);
  }

  @Get('movements')
  @Roles(...MOVEMENT_READ_ROLES)
  @ApiOkResponse({
    description: 'Stock movements listed',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiSuccessResponseDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(StockMovementResponseDto) },
            },
            meta: { $ref: getSchemaPath(StockMovementsPaginationMetaDto) },
          },
        },
      ],
    },
  })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  listStockMovements(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: ListStockMovementsQueryDto,
  ): Promise<PaginatedStockMovementResponseDto> {
    return this.inventoryService.listStockMovements(currentUser, query);
  }
}
