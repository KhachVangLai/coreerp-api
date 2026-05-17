import { UserRole } from '@prisma/client';

export type JwtPayload = {
  sub: string;
  userId: string;
  tenantId: string;
  tenantCode?: string;
  email?: string;
  fullName?: string;
  role: UserRole;
};

export type CurrentUserContext = {
  sub: string;
  userId: string;
  tenantId: string;
  tenantCode?: string;
  email?: string;
  fullName?: string;
  role: UserRole;
};

export type AuthenticatedUser = CurrentUserContext;
