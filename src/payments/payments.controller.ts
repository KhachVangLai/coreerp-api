import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
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
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import {
  PaginatedPaymentResponseDto,
  PaymentInvoiceSummaryDto,
  PaymentResponseDto,
  PaymentsPaginationMetaDto,
  PaymentSalesOrderSummaryDto,
  RecordPaymentResponseDto,
} from './dto/payment-response.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { PaymentsService } from './payments.service';

const PAYMENT_WRITE_ROLES = [UserRole.TENANT_ADMIN, UserRole.FINANCE];
const PAYMENT_READ_ROLES = [
  UserRole.TENANT_ADMIN,
  UserRole.FINANCE,
  UserRole.VIEWER,
];

@ApiTags('Payments')
@ApiBearerAuth('bearer')
@ApiExtraModels(
  ApiSuccessResponseDto,
  ApiErrorResponseDto,
  PaymentResponseDto,
  PaymentInvoiceSummaryDto,
  PaymentSalesOrderSummaryDto,
  RecordPaymentResponseDto,
  PaymentsPaginationMetaDto,
  PaginatedPaymentResponseDto,
)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('invoices/:id/payments')
  @Roles(...PAYMENT_WRITE_ROLES)
  @ApiCreatedResponse({
    description: 'Payment recorded for invoice',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiSuccessResponseDto) },
        {
          properties: {
            data: { $ref: getSchemaPath(RecordPaymentResponseDto) },
          },
        },
      ],
    },
  })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  recordPayment(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RecordPaymentDto,
  ): Promise<RecordPaymentResponseDto> {
    return this.paymentsService.recordPayment(currentUser, id, dto);
  }

  @Get('payments')
  @Roles(...PAYMENT_READ_ROLES)
  @ApiOkResponse({
    description: 'Payments listed',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiSuccessResponseDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(PaymentResponseDto) },
            },
            meta: { $ref: getSchemaPath(PaymentsPaginationMetaDto) },
          },
        },
      ],
    },
  })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  listPayments(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: ListPaymentsQueryDto,
  ): Promise<PaginatedPaymentResponseDto> {
    return this.paymentsService.listPayments(currentUser, query);
  }
}
