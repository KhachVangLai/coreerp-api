import { ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerType, RecordStatus } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateCustomerDto {
  @ApiPropertyOptional({ example: 'Nguyen Van A Updated' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ example: '0909123456', nullable: true })
  @IsOptional()
  @IsString()
  phone?: string | null;

  @ApiPropertyOptional({ example: 'a@example.com', nullable: true })
  @IsOptional()
  @IsEmail()
  email?: string | null;

  @ApiPropertyOptional({ example: '0312345678', nullable: true })
  @IsOptional()
  @IsString()
  taxCode?: string | null;

  @ApiPropertyOptional({ enum: CustomerType, example: CustomerType.B2B })
  @IsOptional()
  @IsEnum(CustomerType)
  type?: CustomerType;

  @ApiPropertyOptional({ enum: RecordStatus, example: RecordStatus.ACTIVE })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}
