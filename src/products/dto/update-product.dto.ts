import { ApiPropertyOptional } from '@nestjs/swagger';
import { RecordStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Matches, MinLength } from 'class-validator';

const NON_NEGATIVE_MONEY_PATTERN = /^(0|[1-9]\d*)(\.\d{1,2})?$/;

export class UpdateProductDto {
  @ApiPropertyOptional({ example: 'Ao thun trang updated' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ example: 'pcs' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  unit?: string;

  @ApiPropertyOptional({ example: '120000.00' })
  @IsOptional()
  @IsString()
  @Matches(NON_NEGATIVE_MONEY_PATTERN, {
    message: 'basePrice must be a non-negative decimal with up to 2 decimals',
  })
  basePrice?: string;

  @ApiPropertyOptional({ enum: RecordStatus, example: RecordStatus.ACTIVE })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}
