import { ApiProperty } from '@nestjs/swagger';

export class ApiSuccessResponseDto<TData = unknown> {
  @ApiProperty({ type: Object })
  data!: TData;
}
