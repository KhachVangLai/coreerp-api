import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiErrorBodyDto {
  @ApiProperty({ example: 'VALIDATION_ERROR' })
  code!: string;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiPropertyOptional({
    example: ['name must be a string'],
    oneOf: [{ type: 'array', items: { type: 'string' } }, { type: 'object' }],
  })
  details?: unknown;
}

export class ApiErrorResponseDto {
  @ApiProperty({ type: ApiErrorBodyDto })
  error!: ApiErrorBodyDto;
}
