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
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import {
  PaginatedProductResponseDto,
  ProductResponseDto,
  ProductsPaginationMetaDto,
} from './dto/product-response.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

const ALL_TENANT_ROLES = [
  UserRole.TENANT_ADMIN,
  UserRole.SALES,
  UserRole.WAREHOUSE,
  UserRole.FINANCE,
  UserRole.VIEWER,
];

@ApiTags('Products')
@ApiBearerAuth('bearer')
@ApiExtraModels(
  ApiSuccessResponseDto,
  ApiErrorResponseDto,
  ProductResponseDto,
  ProductsPaginationMetaDto,
  PaginatedProductResponseDto,
)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles(UserRole.TENANT_ADMIN)
  @ApiCreatedResponse({
    description: 'Product created',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiSuccessResponseDto) },
        { properties: { data: { $ref: getSchemaPath(ProductResponseDto) } } },
      ],
    },
  })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  createProduct(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: CreateProductDto,
  ): Promise<ProductResponseDto> {
    return this.productsService.createProduct(currentUser, dto);
  }

  @Get()
  @Roles(...ALL_TENANT_ROLES)
  @ApiOkResponse({
    description: 'Products listed',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiSuccessResponseDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(ProductResponseDto) },
            },
            meta: { $ref: getSchemaPath(ProductsPaginationMetaDto) },
          },
        },
      ],
    },
  })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  listProducts(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: ListProductsQueryDto,
  ): Promise<PaginatedProductResponseDto> {
    return this.productsService.listProducts(currentUser, query);
  }

  @Get(':id')
  @Roles(...ALL_TENANT_ROLES)
  @ApiOkResponse({
    description: 'Product detail',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiSuccessResponseDto) },
        { properties: { data: { $ref: getSchemaPath(ProductResponseDto) } } },
      ],
    },
  })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  getProduct(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ProductResponseDto> {
    return this.productsService.getProduct(currentUser, id);
  }

  @Patch(':id')
  @Roles(UserRole.TENANT_ADMIN)
  @ApiOkResponse({
    description: 'Product updated',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiSuccessResponseDto) },
        { properties: { data: { $ref: getSchemaPath(ProductResponseDto) } } },
      ],
    },
  })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  updateProduct(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    return this.productsService.updateProduct(currentUser, id, dto);
  }
}
