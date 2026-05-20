import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
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
import { GenerateInvoiceFromSalesOrderDto } from './dto/generate-invoice-from-sales-order.dto';
import {
  InvoiceCustomerSummaryDto,
  InvoiceLineResponseDto,
  InvoicePaymentSummaryDto,
  InvoiceResponseDto,
  InvoiceSalesOrderSummaryDto,
  InvoicesPaginationMetaDto,
  PaginatedInvoiceResponseDto,
} from './dto/invoice-response.dto';
import { IssueInvoiceDto } from './dto/issue-invoice.dto';
import { ListInvoicesQueryDto } from './dto/list-invoices-query.dto';
import { InvoicesService } from './invoices.service';

const INVOICE_WRITE_ROLES = [UserRole.TENANT_ADMIN, UserRole.FINANCE];
const INVOICE_READ_ROLES = [
  UserRole.TENANT_ADMIN,
  UserRole.FINANCE,
  UserRole.VIEWER,
];

@ApiTags('Invoices')
@ApiBearerAuth('bearer')
@ApiExtraModels(
  ApiSuccessResponseDto,
  ApiErrorResponseDto,
  InvoiceResponseDto,
  InvoiceLineResponseDto,
  InvoiceCustomerSummaryDto,
  InvoiceSalesOrderSummaryDto,
  InvoicePaymentSummaryDto,
  InvoicesPaginationMetaDto,
  PaginatedInvoiceResponseDto,
)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post('from-sales-order/:salesOrderId')
  @Roles(...INVOICE_WRITE_ROLES)
  @ApiCreatedResponse({
    description: 'Invoice generated from fulfilled sales order',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiSuccessResponseDto) },
        { properties: { data: { $ref: getSchemaPath(InvoiceResponseDto) } } },
      ],
    },
  })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  generateFromSalesOrder(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('salesOrderId') salesOrderId: string,
    @Body() dto: GenerateInvoiceFromSalesOrderDto,
  ): Promise<InvoiceResponseDto> {
    return this.invoicesService.generateFromSalesOrder(
      currentUser,
      salesOrderId,
      dto,
    );
  }

  @Patch(':id/issue')
  @Roles(...INVOICE_WRITE_ROLES)
  @ApiOkResponse({
    description: 'Draft invoice issued',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiSuccessResponseDto) },
        { properties: { data: { $ref: getSchemaPath(InvoiceResponseDto) } } },
      ],
    },
  })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  issueInvoice(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: IssueInvoiceDto,
  ): Promise<InvoiceResponseDto> {
    return this.invoicesService.issueInvoice(currentUser, id, dto);
  }

  @Get()
  @Roles(...INVOICE_READ_ROLES)
  @ApiOkResponse({
    description: 'Invoices listed',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiSuccessResponseDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(InvoiceResponseDto) },
            },
            meta: { $ref: getSchemaPath(InvoicesPaginationMetaDto) },
          },
        },
      ],
    },
  })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  listInvoices(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: ListInvoicesQueryDto,
  ): Promise<PaginatedInvoiceResponseDto> {
    return this.invoicesService.listInvoices(currentUser, query);
  }

  @Get(':id')
  @Roles(...INVOICE_READ_ROLES)
  @ApiOkResponse({
    description: 'Invoice detail',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiSuccessResponseDto) },
        { properties: { data: { $ref: getSchemaPath(InvoiceResponseDto) } } },
      ],
    },
  })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  getInvoice(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<InvoiceResponseDto> {
    return this.invoicesService.getInvoice(currentUser, id);
  }
}
