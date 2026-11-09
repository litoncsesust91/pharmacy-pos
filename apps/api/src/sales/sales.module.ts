import { Module } from '@nestjs/common';
import { SalesController } from './sales.controller.js';
import { SalesService } from './sales.service.js';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module.js';

@Module({
  imports: [SubscriptionsModule],
  controllers: [SalesController],
  providers: [SalesService],
})
export class SalesModule {}
