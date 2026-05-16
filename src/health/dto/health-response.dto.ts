import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok' })
  status!: 'ok';

  @ApiProperty({ example: 'coreerp-api' })
  service!: string;

  @ApiProperty({ example: '2026-05-16T09:00:00.000Z' })
  timestamp!: string;
}
