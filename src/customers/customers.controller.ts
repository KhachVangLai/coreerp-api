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
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ListCustomersQueryDto } from './dto/list-customers-query.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import {
  CustomerResponseDto,
  CustomersPaginationMetaDto,
  PaginatedCustomerResponseDto,
} from './dto/customer-response.dto';
import { CustomersService } from './customers.service';

const ALL_TENANT_ROLES = [
  UserRole.TENANT_ADMIN,
  UserRole.SALES,
  UserRole.WAREHOUSE,
  UserRole.FINANCE,
  UserRole.VIEWER,
];

@ApiTags('Customers')
@ApiBearerAuth('bearer')
@ApiExtraModels(
  ApiSuccessResponseDto,
  ApiErrorResponseDto,
  CustomerResponseDto,
  CustomersPaginationMetaDto,
  PaginatedCustomerResponseDto,
)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @Roles(UserRole.TENANT_ADMIN, UserRole.SALES)
  @ApiCreatedResponse({
    description: 'Customer created',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiSuccessResponseDto) },
        { properties: { data: { $ref: getSchemaPath(CustomerResponseDto) } } },
      ],
    },
  })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  createCustomer(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: CreateCustomerDto,
  ): Promise<CustomerResponseDto> {
    return this.customersService.createCustomer(currentUser, dto);
  }

  @Get()
  @Roles(...ALL_TENANT_ROLES)
  @ApiOkResponse({
    description: 'Customers listed',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiSuccessResponseDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(CustomerResponseDto) },
            },
            meta: { $ref: getSchemaPath(CustomersPaginationMetaDto) },
          },
        },
      ],
    },
  })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  listCustomers(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: ListCustomersQueryDto,
  ): Promise<PaginatedCustomerResponseDto> {
    return this.customersService.listCustomers(currentUser, query);
  }

  @Get(':id')
  @Roles(...ALL_TENANT_ROLES)
  @ApiOkResponse({
    description: 'Customer detail',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiSuccessResponseDto) },
        { properties: { data: { $ref: getSchemaPath(CustomerResponseDto) } } },
      ],
    },
  })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  getCustomer(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<CustomerResponseDto> {
    return this.customersService.getCustomer(currentUser, id);
  }

  @Patch(':id')
  @Roles(UserRole.TENANT_ADMIN, UserRole.SALES)
  @ApiOkResponse({
    description: 'Customer updated',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiSuccessResponseDto) },
        { properties: { data: { $ref: getSchemaPath(CustomerResponseDto) } } },
      ],
    },
  })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  updateCustomer(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ): Promise<CustomerResponseDto> {
    return this.customersService.updateCustomer(currentUser, id, dto);
  }
}
