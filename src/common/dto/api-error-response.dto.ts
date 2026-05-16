import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiErrorBodyDto {
  @ApiProperty({ example: 'Bad Request' })
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
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: '2026-05-16T09:00:00.000Z' })
  timestamp!: string;

  @ApiProperty({ example: '/api/v1/health' })
  path!: string;

  @ApiProperty({ type: ApiErrorBodyDto })
  error!: ApiErrorBodyDto;
}
