import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import { IsEnum, IsISO8601, IsOptional, IsString, Matches } from 'class-validator';

const POSITIVE_MONEY_PATTERN = /^(?=.*[1-9])\d+(\.\d{1,2})?$/;

export class RecordPaymentDto {
  @ApiProperty({ example: '300000.00' })
  @IsString()
  @Matches(POSITIVE_MONEY_PATTERN, {
    message: 'amount must be a positive decimal with up to 2 decimals',
  })
  amount!: string;

  @ApiProperty({
    enum: PaymentMethod,
    example: PaymentMethod.BANK_TRANSFER,
  })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @ApiPropertyOptional({ example: 'VCB123456', nullable: true })
  @IsOptional()
  @IsString()
  referenceNo?: string;

  @ApiPropertyOptional({ example: '2026-05-16T10:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  paidAt?: string;
}
