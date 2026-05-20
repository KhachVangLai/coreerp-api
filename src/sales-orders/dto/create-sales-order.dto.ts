import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const NON_NEGATIVE_MONEY_PATTERN = /^(0|[1-9]\d*)(\.\d{1,2})?$/;

export class CreateSalesOrderLineDto {
  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  @IsString()
  productId!: string;

  @ApiProperty({ example: 5, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({ example: '120000.00' })
  @IsString()
  @Matches(NON_NEGATIVE_MONEY_PATTERN, {
    message: 'unitPrice must be a non-negative decimal with up to 2 decimals',
  })
  unitPrice!: string;
}

export class CreateSalesOrderDto {
  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  @IsString()
  customerId!: string;

  @ApiProperty({ example: '7dfc5a25-5f0f-46f4-a7cb-8f3e8dc7f9cc' })
  @IsString()
  warehouseId!: string;

  @ApiPropertyOptional({ example: '0.00', default: '0.00' })
  @IsOptional()
  @IsString()
  @Matches(NON_NEGATIVE_MONEY_PATTERN, {
    message: 'discountAmount must be a non-negative decimal with up to 2 decimals',
  })
  discountAmount = '0.00';

  @ApiPropertyOptional({ example: '0.00', default: '0.00' })
  @IsOptional()
  @IsString()
  @Matches(NON_NEGATIVE_MONEY_PATTERN, {
    message: 'taxAmount must be a non-negative decimal with up to 2 decimals',
  })
  taxAmount = '0.00';

  @ApiPropertyOptional({ example: 'Customer wants delivery today' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  note?: string;

  @ApiProperty({ type: [CreateSalesOrderLineDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateSalesOrderLineDto)
  lines!: CreateSalesOrderLineDto[];
}
