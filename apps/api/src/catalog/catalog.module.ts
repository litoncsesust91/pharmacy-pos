import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module.js';

@Module({
  imports: [SubscriptionsModule],
  controllers: [CatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}
