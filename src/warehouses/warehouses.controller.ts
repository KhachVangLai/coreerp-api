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
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { ListWarehousesQueryDto } from './dto/list-warehouses-query.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import {
  PaginatedWarehouseResponseDto,
  WarehouseResponseDto,
  WarehousesPaginationMetaDto,
} from './dto/warehouse-response.dto';
import { WarehousesService } from './warehouses.service';

const ALL_TENANT_ROLES = [
  UserRole.TENANT_ADMIN,
  UserRole.SALES,
  UserRole.WAREHOUSE,
  UserRole.FINANCE,
  UserRole.VIEWER,
];

@ApiTags('Warehouses')
@ApiBearerAuth('bearer')
@ApiExtraModels(
  ApiSuccessResponseDto,
  ApiErrorResponseDto,
  WarehouseResponseDto,
  WarehousesPaginationMetaDto,
  PaginatedWarehouseResponseDto,
)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('warehouses')
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Post()
  @Roles(UserRole.TENANT_ADMIN)
  @ApiCreatedResponse({
    description: 'Warehouse created',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiSuccessResponseDto) },
        { properties: { data: { $ref: getSchemaPath(WarehouseResponseDto) } } },
      ],
    },
  })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  createWarehouse(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: CreateWarehouseDto,
  ): Promise<WarehouseResponseDto> {
    return this.warehousesService.createWarehouse(currentUser, dto);
  }

  @Get()
  @Roles(...ALL_TENANT_ROLES)
  @ApiOkResponse({
    description: 'Warehouses listed',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiSuccessResponseDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(WarehouseResponseDto) },
            },
            meta: { $ref: getSchemaPath(WarehousesPaginationMetaDto) },
          },
        },
      ],
    },
  })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  listWarehouses(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: ListWarehousesQueryDto,
  ): Promise<PaginatedWarehouseResponseDto> {
    return this.warehousesService.listWarehouses(currentUser, query);
  }

  @Get(':id')
  @Roles(...ALL_TENANT_ROLES)
  @ApiOkResponse({
    description: 'Warehouse detail',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiSuccessResponseDto) },
        { properties: { data: { $ref: getSchemaPath(WarehouseResponseDto) } } },
      ],
    },
  })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  getWarehouse(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<WarehouseResponseDto> {
    return this.warehousesService.getWarehouse(currentUser, id);
  }

  @Patch(':id')
  @Roles(UserRole.TENANT_ADMIN)
  @ApiOkResponse({
    description: 'Warehouse updated',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiSuccessResponseDto) },
        { properties: { data: { $ref: getSchemaPath(WarehouseResponseDto) } } },
      ],
    },
  })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  updateWarehouse(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateWarehouseDto,
  ): Promise<WarehouseResponseDto> {
    return this.warehousesService.updateWarehouse(currentUser, id, dto);
  }
}
