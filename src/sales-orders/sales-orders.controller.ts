import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
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
import { CancelSalesOrderDto } from './dto/cancel-sales-order.dto';
import { ConfirmSalesOrderDto } from './dto/confirm-sales-order.dto';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { ListSalesOrdersQueryDto } from './dto/list-sales-orders-query.dto';
import {
  CancelSalesOrderResponseDto,
  ConfirmSalesOrderResponseDto,
  PaginatedSalesOrderResponseDto,
  SalesOrderCustomerSummaryDto,
  SalesOrderInvoiceSummaryDto,
  SalesOrderLineResponseDto,
  SalesOrderReservationSummaryDto,
  SalesOrderResponseDto,
  SalesOrdersPaginationMetaDto,
  SalesOrderWarehouseSummaryDto,
} from './dto/sales-order-response.dto';
import { SalesOrdersService } from './sales-orders.service';

const SALES_ORDER_CREATE_ROLES = [UserRole.TENANT_ADMIN, UserRole.SALES];
const SALES_ORDER_READ_ROLES = [
  UserRole.TENANT_ADMIN,
  UserRole.SALES,
  UserRole.WAREHOUSE,
  UserRole.FINANCE,
  UserRole.VIEWER,
];

@ApiTags('Sales Orders')
@ApiBearerAuth('bearer')
@ApiExtraModels(
  ApiSuccessResponseDto,
  ApiErrorResponseDto,
  CancelSalesOrderResponseDto,
  ConfirmSalesOrderResponseDto,
  SalesOrderResponseDto,
  SalesOrderLineResponseDto,
  SalesOrderCustomerSummaryDto,
  SalesOrderWarehouseSummaryDto,
  SalesOrderInvoiceSummaryDto,
  SalesOrderReservationSummaryDto,
  SalesOrdersPaginationMetaDto,
  PaginatedSalesOrderResponseDto,
)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sales-orders')
export class SalesOrdersController {
  constructor(private readonly salesOrdersService: SalesOrdersService) {}

  @Post()
  @Roles(...SALES_ORDER_CREATE_ROLES)
  @ApiCreatedResponse({
    description: 'Draft sales order created',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiSuccessResponseDto) },
        {
          properties: {
            data: { $ref: getSchemaPath(SalesOrderResponseDto) },
          },
        },
      ],
    },
  })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  createSalesOrder(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: CreateSalesOrderDto,
  ): Promise<SalesOrderResponseDto> {
    return this.salesOrdersService.createSalesOrder(currentUser, dto);
  }

  @Get()
  @Roles(...SALES_ORDER_READ_ROLES)
  @ApiOkResponse({
    description: 'Sales orders listed',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiSuccessResponseDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(SalesOrderResponseDto) },
            },
            meta: { $ref: getSchemaPath(SalesOrdersPaginationMetaDto) },
          },
        },
      ],
    },
  })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  listSalesOrders(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: ListSalesOrdersQueryDto,
  ): Promise<PaginatedSalesOrderResponseDto> {
    return this.salesOrdersService.listSalesOrders(currentUser, query);
  }

  @Get(':id')
  @Roles(...SALES_ORDER_READ_ROLES)
  @ApiOkResponse({
    description: 'Sales order detail',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiSuccessResponseDto) },
        {
          properties: {
            data: { $ref: getSchemaPath(SalesOrderResponseDto) },
          },
        },
      ],
    },
  })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  getSalesOrder(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<SalesOrderResponseDto> {
    return this.salesOrdersService.getSalesOrder(currentUser, id);
  }

  @Patch(':id/confirm')
  @Roles(...SALES_ORDER_CREATE_ROLES)
  @ApiOkResponse({
    description: 'Draft sales order confirmed and stock reserved',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiSuccessResponseDto) },
        {
          properties: {
            data: { $ref: getSchemaPath(ConfirmSalesOrderResponseDto) },
          },
        },
      ],
    },
  })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  confirmSalesOrder(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ConfirmSalesOrderDto,
  ): Promise<ConfirmSalesOrderResponseDto> {
    return this.salesOrdersService.confirmSalesOrder(currentUser, id, dto);
  }

  @Patch(':id/cancel')
  @Roles(...SALES_ORDER_CREATE_ROLES)
  @ApiOkResponse({
    description: 'Sales order cancelled and reserved stock released if needed',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiSuccessResponseDto) },
        {
          properties: {
            data: { $ref: getSchemaPath(CancelSalesOrderResponseDto) },
          },
        },
      ],
    },
  })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  cancelSalesOrder(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CancelSalesOrderDto,
  ): Promise<CancelSalesOrderResponseDto> {
    return this.salesOrdersService.cancelSalesOrder(currentUser, id, dto);
  }
}
