import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfig, appConfig } from './config/app.config.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { TenantsModule } from './tenants/tenants.module.js';
import { AuditModule } from './audit/audit.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { PurchasingModule } from './purchasing/purchasing.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [appConfig],
    }),
    HealthModule,
    PrismaModule,
    AuditModule,
    AuthModule,
    TenantsModule,
    SettingsModule,
    CatalogModule,
    InventoryModule,
    PurchasingModule,
  ],
  providers: [AppConfig],
})
export class AppModule {}
