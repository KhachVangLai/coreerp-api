import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './auth/auth.module';
import appConfig from './config/app.config';
import { CustomersModule } from './customers/customers.module';
import { HealthModule } from './health/health.module';
import { InventoryModule } from './inventory/inventory.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { UsersModule } from './users/users.module';
import { WarehousesModule } from './warehouses/warehouses.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CustomersModule,
    ProductsModule,
    WarehousesModule,
    InventoryModule,
    HealthModule,
  ],
})
export class AppModule {}
