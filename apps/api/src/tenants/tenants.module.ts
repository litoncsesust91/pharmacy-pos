import { Module } from '@nestjs/common';
import { TenantsController } from './tenants.controller.js';
import { TenantsService } from './tenants.service.js';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module.js';

@Module({
  controllers: [TenantsController],
  imports: [SubscriptionsModule],
  providers: [TenantsService],
})
export class TenantsModule {}
