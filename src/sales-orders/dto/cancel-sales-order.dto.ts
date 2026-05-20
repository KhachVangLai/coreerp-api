import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CancelSalesOrderDto {
  @ApiProperty({ example: 'Customer cancelled' })
  @IsString()
  @MinLength(1)
  reason!: string;
}
