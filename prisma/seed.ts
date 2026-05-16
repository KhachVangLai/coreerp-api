import * as bcrypt from 'bcrypt';
import {
  PrismaClient,
  TenantStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

const demoPassword = '123456';
const saltRounds = 10;

type DemoUser = {
  email: string;
  fullName: string;
  role: UserRole;
};

type DemoTenant = {
  code: string;
  name: string;
  users: DemoUser[];
};

// Local demo accounts only. Do not reuse this password strategy for production data.
const demoTenants: DemoTenant[] = [
  {
    code: 'minh-anh-retail',
    name: 'Minh Anh Retail Co.',
    users: [
      {
        email: 'admin@minhanh.vn',
        fullName: 'Minh Anh Tenant Admin',
        role: UserRole.TENANT_ADMIN,
      },
      {
        email: 'sales@minhanh.vn',
        fullName: 'Minh Anh Sales User',
        role: UserRole.SALES,
      },
      {
        email: 'warehouse@minhanh.vn',
        fullName: 'Minh Anh Warehouse User',
        role: UserRole.WAREHOUSE,
      },
      {
        email: 'finance@minhanh.vn',
        fullName: 'Minh Anh Finance User',
        role: UserRole.FINANCE,
      },
      {
        email: 'viewer@minhanh.vn',
        fullName: 'Minh Anh Viewer User',
        role: UserRole.VIEWER,
      },
    ],
  },
  {
    code: 'hoang-long-fashion',
    name: 'Hoang Long Fashion Co.',
    users: [
      {
        email: 'admin@hoanglong.vn',
        fullName: 'Hoang Long Tenant Admin',
        role: UserRole.TENANT_ADMIN,
      },
      {
        email: 'sales@hoanglong.vn',
        fullName: 'Hoang Long Sales User',
        role: UserRole.SALES,
      },
      {
        email: 'warehouse@hoanglong.vn',
        fullName: 'Hoang Long Warehouse User',
        role: UserRole.WAREHOUSE,
      },
      {
        email: 'finance@hoanglong.vn',
        fullName: 'Hoang Long Finance User',
        role: UserRole.FINANCE,
      },
      {
        email: 'viewer@hoanglong.vn',
        fullName: 'Hoang Long Viewer User',
        role: UserRole.VIEWER,
      },
    ],
  },
];

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(demoPassword, saltRounds);

  for (const demoTenant of demoTenants) {
    const tenant = await prisma.tenant.upsert({
      where: { code: demoTenant.code },
      update: {
        name: demoTenant.name,
        status: TenantStatus.ACTIVE,
      },
      create: {
        code: demoTenant.code,
        name: demoTenant.name,
        status: TenantStatus.ACTIVE,
      },
    });

    for (const demoUser of demoTenant.users) {
      // Local demo accounts only. The plaintext password is never stored.
      await prisma.user.upsert({
        where: {
          tenantId_email: {
            tenantId: tenant.id,
            email: demoUser.email,
          },
        },
        update: {
          fullName: demoUser.fullName,
          role: demoUser.role,
          status: UserStatus.ACTIVE,
          passwordHash,
        },
        create: {
          tenantId: tenant.id,
          email: demoUser.email,
          passwordHash,
          fullName: demoUser.fullName,
          role: demoUser.role,
          status: UserStatus.ACTIVE,
        },
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
