import { ApiProperty } from '@nestjs/swagger';

export class ApiSuccessResponseDto<TData = unknown> {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 200 })
  statusCode!: number;

  @ApiProperty({ example: '2026-05-16T09:00:00.000Z' })
  timestamp!: string;

  @ApiProperty({ example: '/api/v1/health' })
  path!: string;

  data!: TData;
}
