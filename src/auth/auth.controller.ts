import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';

import { ApiSuccessResponseDto } from '../common/dto/api-success-response.dto';
import { CurrentUser } from './decorators/current-user.decorator';
import {
  CurrentUserProfileDto,
  LoginResponseDto,
} from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { AuthenticatedUser } from './types/auth-user.type';

@ApiTags('Auth')
@ApiExtraModels(ApiSuccessResponseDto, LoginResponseDto, CurrentUserProfileDto)
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: 'Login succeeded',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiSuccessResponseDto) },
        {
          properties: {
            data: { $ref: getSchemaPath(LoginResponseDto) },
          },
        },
      ],
    },
  })
  login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOkResponse({
    description: 'Current user profile',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiSuccessResponseDto) },
        {
          properties: {
            data: { $ref: getSchemaPath(CurrentUserProfileDto) },
          },
        },
      ],
    },
  })
  getMe(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<CurrentUserProfileDto> {
    return this.authService.getCurrentUser(currentUser);
  }
}
