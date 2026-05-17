import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerType } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty({ example: 'CUS001' })
  @IsString()
  @MinLength(1)
  code!: string;

  @ApiProperty({ example: 'Nguyen Van A' })
  @IsString()
  @MinLength(1)
  name!: string;

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

  @ApiProperty({ enum: CustomerType, example: CustomerType.B2C })
  @IsEnum(CustomerType)
  type!: CustomerType;
}
