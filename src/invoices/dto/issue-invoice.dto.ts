import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class IssueInvoiceDto {
  @ApiPropertyOptional({ example: 'Issued to customer' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  note?: string;
}
