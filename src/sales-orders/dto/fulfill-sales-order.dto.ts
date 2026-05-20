import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class FulfillSalesOrderDto {
  @ApiPropertyOptional({ example: 'Picked and shipped' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  note?: string;
}
