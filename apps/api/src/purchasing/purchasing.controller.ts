import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import {
  CreatePurchaseOrderDto,
  CreatePurchaseReturnDto,
  PaySupplierDto,
  PurchaseOrderQueryDto,
  ReceivePurchaseOrderDto,
  ReviewPurchaseOrderDto,
  ReviewPurchaseReturnDto,
  UpdateSupplierTermsDto,
} from './dto/purchasing.dto.js';
import { PurchasingService } from './purchasing.service.js';

@ApiTags('purchasing')
@Controller('purchasing')
export class PurchasingController {
  constructor(private readonly purchasing: PurchasingService) {}

  @Get('suppliers/:supplierId/terms')
  @RequirePermissions('purchasing.read')
  getSupplierTerms(@CurrentUser() user: AuthenticatedUser, @Param('supplierId') supplierId: string) {
    return this.purchasing.getSupplierTerms(user, supplierId);
  }

  @Patch('suppliers/:supplierId/terms')
  @RequirePermissions('purchasing.manage')
  updateSupplierTerms(
    @CurrentUser() user: AuthenticatedUser,
    @Param('supplierId') supplierId: string,
    @Body() input: UpdateSupplierTermsDto,
  ) {
    return this.purchasing.updateSupplierTerms(user, supplierId, input);
  }

  @Get('orders')
  @RequirePermissions('purchasing.read')
  listOrders(@CurrentUser() user: AuthenticatedUser, @Query() query: PurchaseOrderQueryDto) {
    return this.purchasing.listOrders(user, query);
  }

  @Post('orders')
  @RequirePermissions('purchasing.create')
  createOrder(@CurrentUser() user: AuthenticatedUser, @Body() input: CreatePurchaseOrderDto) {
    return this.purchasing.createOrder(user, input);
  }

  @Post('orders/:orderId/submit')
  @RequirePermissions('purchasing.create')
  submitOrder(@CurrentUser() user: AuthenticatedUser, @Param('orderId') orderId: string) {
    return this.purchasing.submitOrder(user, orderId);
  }

  @Post('orders/:orderId/review')
  @RequirePermissions('purchasing.approve')
  reviewOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
    @Body() input: ReviewPurchaseOrderDto,
  ) {
    return this.purchasing.reviewOrder(user, orderId, input);
  }

  @Post('orders/:orderId/receive')
  @RequirePermissions('purchasing.receive')
  receiveOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
    @Body() input: ReceivePurchaseOrderDto,
  ) {
    return this.purchasing.receiveOrder(user, orderId, input);
  }

  @Get('returns')
  @RequirePermissions('purchasing.read')
  listReturns(@CurrentUser() user: AuthenticatedUser) {
    return this.purchasing.listReturns(user);
  }

  @Post('returns')
  @RequirePermissions('purchasing.return')
  createReturn(@CurrentUser() user: AuthenticatedUser, @Body() input: CreatePurchaseReturnDto) {
    return this.purchasing.createReturn(user, input);
  }

  @Post('returns/:returnId/review')
  @RequirePermissions('purchasing.approve')
  reviewReturn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('returnId') returnId: string,
    @Body() input: ReviewPurchaseReturnDto,
  ) {
    return this.purchasing.reviewReturn(user, returnId, input);
  }

  @Post('returns/:returnId/complete')
  @RequirePermissions('purchasing.return')
  completeReturn(@CurrentUser() user: AuthenticatedUser, @Param('returnId') returnId: string) {
    return this.purchasing.completeReturn(user, returnId);
  }

  @Get('payables')
  @RequirePermissions('purchasing.read')
  listPayables(@CurrentUser() user: AuthenticatedUser) {
    return this.purchasing.listPayables(user);
  }

  @Post('payables/:payableId/pay')
  @RequirePermissions('purchasing.pay')
  paySupplier(
    @CurrentUser() user: AuthenticatedUser,
    @Param('payableId') payableId: string,
    @Body() input: PaySupplierDto,
  ) {
    return this.purchasing.paySupplier(user, payableId, input);
  }
}
