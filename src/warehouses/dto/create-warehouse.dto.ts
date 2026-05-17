import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateWarehouseDto {
  @ApiProperty({ example: 'HN01' })
  @IsString()
  @MinLength(1)
  code!: string;

  @ApiProperty({ example: 'Kho Ha Noi' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional({ example: 'Ha Noi', nullable: true })
  @IsOptional()
  @IsString()
  address?: string | null;
}
