import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public, RequirePermissions } from '../auth/auth.decorators.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import {
  ApproveCloseDto,
  CashMovementDto,
  CloseSessionDto,
  CreatePaymentDto,
  CreateRefundDto,
  CreateRegisterDto,
  OpenSessionDto,
  PaymentWebhookDto,
  ReviewRefundDto,
} from './dto/payments.dto.js';
import { PaymentsService } from './payments.service.js';

@ApiTags('payments')
@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('cash/registers')
  @RequirePermissions('payments.read')
  listRegisters(@CurrentUser() user: AuthenticatedUser) {
    return this.payments.listRegisters(user);
  }

  @Post('cash/registers')
  @RequirePermissions('cash.manage')
  createRegister(@CurrentUser() user: AuthenticatedUser, @Body() input: CreateRegisterDto) {
    return this.payments.createRegister(user, input);
  }

  @Get('cash/sessions/current')
  @RequirePermissions('payments.read')
  currentSession(@CurrentUser() user: AuthenticatedUser) {
    return this.payments.currentSession(user);
  }

  @Post('cash/sessions')
  @RequirePermissions('cash.open')
  openSession(@CurrentUser() user: AuthenticatedUser, @Body() input: OpenSessionDto) {
    return this.payments.openSession(user, input);
  }

  @Post('cash/sessions/:sessionId/movements')
  @RequirePermissions('cash.manage')
  cashMovement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
    @Body() input: CashMovementDto,
  ) {
    return this.payments.cashMovement(user, sessionId, input);
  }

  @Post('cash/sessions/:sessionId/close')
  @RequirePermissions('cash.close')
  closeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
    @Body() input: CloseSessionDto,
  ) {
    return this.payments.closeSession(user, sessionId, input);
  }

  @Post('cash/sessions/:sessionId/approve')
  @RequirePermissions('cash.approve')
  approveClose(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
    @Body() input: ApproveCloseDto,
  ) {
    return this.payments.approveClose(user, sessionId, input);
  }

  @Post('payments')
  @RequirePermissions('payments.create')
  createPayment(@CurrentUser() user: AuthenticatedUser, @Body() input: CreatePaymentDto) {
    return this.payments.createPayment(user, input);
  }

  @Public()
  @Post('payments/webhook')
  webhook(@Headers('x-payment-signature') signature: string | undefined, @Body() input: PaymentWebhookDto) {
    return this.payments.handleWebhook(signature, input);
  }

  @Post('refunds')
  @RequirePermissions('payments.refund')
  createRefund(@CurrentUser() user: AuthenticatedUser, @Body() input: CreateRefundDto) {
    return this.payments.createRefund(user, input);
  }

  @Post('refunds/:refundId/review')
  @RequirePermissions('payments.approve')
  reviewRefund(
    @CurrentUser() user: AuthenticatedUser,
    @Param('refundId') refundId: string,
    @Body() input: ReviewRefundDto,
  ) {
    return this.payments.reviewRefund(user, refundId, input);
  }

  @Post('refunds/:refundId/complete')
  @RequirePermissions('payments.refund')
  completeRefund(@CurrentUser() user: AuthenticatedUser, @Param('refundId') refundId: string) {
    return this.payments.completeRefund(user, refundId);
  }
}
