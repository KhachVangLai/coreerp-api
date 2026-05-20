import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class ConfirmSalesOrderDto {
  @ApiPropertyOptional({ example: 'Confirmed by sales' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  note?: string;
}
