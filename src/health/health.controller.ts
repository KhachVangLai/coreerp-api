import { Controller, Get } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, ApiTags, getSchemaPath } from '@nestjs/swagger';

import { ApiSuccessResponseDto } from '../common/dto/api-success-response.dto';
import { HealthResponseDto } from './dto/health-response.dto';
import { HealthService } from './health.service';

@ApiTags('Health')
@ApiExtraModels(ApiSuccessResponseDto, HealthResponseDto)
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOkResponse({
    description: 'Health check succeeded',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiSuccessResponseDto) },
        {
          properties: {
            data: { $ref: getSchemaPath(HealthResponseDto) },
          },
        },
      ],
    },
  })
  getHealth(): HealthResponseDto {
    return this.healthService.getHealth();
  }
}
