import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TenantStatus, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-code.enum';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUserProfileDto, LoginResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { AuthenticatedUser, JwtPayload } from './types/auth-user.type';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { code: dto.tenantCode },
    });

    if (!tenant) {
      throw this.invalidCredentials();
    }

    if (tenant.status !== TenantStatus.ACTIVE) {
      throw new BusinessException(
        ErrorCode.TENANT_SUSPENDED,
        'Tenant is suspended',
        HttpStatus.FORBIDDEN,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email: dto.email,
        },
      },
    });

    if (!user) {
      throw this.invalidCredentials();
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new BusinessException(
        ErrorCode.USER_INACTIVE,
        'User is inactive',
        HttpStatus.FORBIDDEN,
      );
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordMatches) {
      throw this.invalidCredentials();
    }

    const profile: CurrentUserProfileDto = {
      id: user.id,
      tenantId: user.tenantId,
      tenantCode: tenant.code,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
    };

    const payload: JwtPayload = {
      sub: user.id,
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: profile,
    };
  }

  async getCurrentUser(
    currentUser: AuthenticatedUser,
  ): Promise<CurrentUserProfileDto> {
    const user = await this.prisma.user.findUnique({
      where: {
        id: currentUser.userId,
      },
      include: {
        tenant: true,
      },
    });

    if (!user) {
      throw new BusinessException(
        ErrorCode.UNAUTHORIZED,
        'Unauthorized',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (user.tenantId !== currentUser.tenantId) {
      throw new BusinessException(
        ErrorCode.TENANT_ACCESS_DENIED,
        'Tenant access denied',
        HttpStatus.FORBIDDEN,
      );
    }

    if (user.tenant.status !== TenantStatus.ACTIVE) {
      throw new BusinessException(
        ErrorCode.TENANT_SUSPENDED,
        'Tenant is suspended',
        HttpStatus.FORBIDDEN,
      );
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new BusinessException(
        ErrorCode.USER_INACTIVE,
        'User is inactive',
        HttpStatus.FORBIDDEN,
      );
    }

    return {
      id: user.id,
      tenantId: user.tenantId,
      tenantCode: user.tenant.code,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
    };
  }

  private invalidCredentials(): BusinessException {
    return new BusinessException(
      ErrorCode.INVALID_CREDENTIALS,
      'Invalid tenant, email, or password',
      HttpStatus.UNAUTHORIZED,
    );
  }
}
