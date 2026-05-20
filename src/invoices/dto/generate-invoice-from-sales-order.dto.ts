import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class GenerateInvoiceFromSalesOrderDto {
  @ApiPropertyOptional({ example: 'Generate invoice after fulfillment' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  note?: string;
}
