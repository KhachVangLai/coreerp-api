import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength } from 'class-validator';

const NON_NEGATIVE_MONEY_PATTERN = /^(0|[1-9]\d*)(\.\d{1,2})?$/;

export class CreateProductDto {
  @ApiProperty({ example: 'SP001' })
  @IsString()
  @MinLength(1)
  sku!: string;

  @ApiProperty({ example: 'Ao thun trang' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: 'pcs' })
  @IsString()
  @MinLength(1)
  unit!: string;

  @ApiProperty({ example: '120000.00' })
  @IsString()
  @Matches(NON_NEGATIVE_MONEY_PATTERN, {
    message: 'basePrice must be a non-negative decimal with up to 2 decimals',
  })
  basePrice!: string;
}
