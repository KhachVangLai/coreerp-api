import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { AuthenticatedUser } from '../auth/types/auth-user.type';
import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-code.enum';
import {
  createPaginationMeta,
  getPaginationSkip,
} from '../common/pagination/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginatedUserResponseDto, UserResponseDto } from './dto/user-response.dto';

const USER_SAFE_SELECT = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  status: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async createUser(
    currentUser: AuthenticatedUser,
    dto: CreateUserDto,
  ): Promise<UserResponseDto> {
    const existingUser = await this.prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId: currentUser.tenantId,
          email: dto.email,
        },
      },
      select: { id: true },
    });

    if (existingUser) {
      throw new BusinessException(
        ErrorCode.DUPLICATE_RESOURCE,
        'User email already exists in this tenant',
        HttpStatus.CONFLICT,
        { email: dto.email },
      );
    }

    return this.prisma.user.create({
      data: {
        tenantId: currentUser.tenantId,
        email: dto.email,
        passwordHash: await bcrypt.hash(dto.password, 10),
        fullName: dto.fullName,
        role: dto.role,
      },
      select: USER_SAFE_SELECT,
    });
  }

  async listUsers(
    currentUser: AuthenticatedUser,
    query: ListUsersQueryDto,
  ): Promise<PaginatedUserResponseDto> {
    const page = query.page;
    const limit = query.limit;
    const where: Prisma.UserWhereInput = {
      tenantId: currentUser.tenantId,
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { email: { contains: query.q, mode: Prisma.QueryMode.insensitive } },
              {
                fullName: {
                  contains: query.q,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: USER_SAFE_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: getPaginationSkip(page, limit),
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      meta: createPaginationMeta(total, page, limit),
    };
  }

  async updateUser(
    currentUser: AuthenticatedUser,
    id: string,
    dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const targetUser = await this.prisma.user.findFirst({
      where: {
        id,
        tenantId: currentUser.tenantId,
      },
      select: { id: true },
    });

    if (!targetUser) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        'User not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (id === currentUser.userId && dto.status === UserStatus.INACTIVE) {
      throw new BusinessException(
        ErrorCode.FORBIDDEN,
        'Tenant admin cannot disable their own account',
        HttpStatus.FORBIDDEN,
      );
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        fullName: dto.fullName,
        role: dto.role,
        status: dto.status,
      },
      select: USER_SAFE_SELECT,
    });
  }
}
