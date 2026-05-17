import { UserRole } from '@prisma/client';

export type JwtPayload = {
  sub: string;
  userId: string;
  tenantId: string;
  role: UserRole;
};

export type AuthenticatedUser = JwtPayload & {
  email?: string;
  fullName?: string;
};
