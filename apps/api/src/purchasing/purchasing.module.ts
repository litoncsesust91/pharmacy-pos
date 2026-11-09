import { Module } from '@nestjs/common';
import { PurchasingController } from './purchasing.controller.js';
import { PurchasingService } from './purchasing.service.js';

@Module({
  controllers: [PurchasingController],
  providers: [PurchasingService],
})
export class PurchasingModule {}
