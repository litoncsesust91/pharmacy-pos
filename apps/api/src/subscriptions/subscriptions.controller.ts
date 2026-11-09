import { Body, Controller, Get, Headers, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public, RequirePermissions } from '../auth/auth.decorators.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { BillingWebhookDto, CancelSubscriptionDto, ChangeSubscriptionDto } from './dto/subscriptions.dto.js';
import { SubscriptionsService } from './subscriptions.service.js';

@ApiTags('subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get('plans')
  @Public()
  plans() { return this.subscriptions.getPlans(); }

  @Get('current')
  @RequirePermissions('subscription.read')
  current(@CurrentUser() user: AuthenticatedUser) { return this.subscriptions.getCurrent(user); }

  @Patch('current/plan')
  @RequirePermissions('subscription.manage')
  changePlan(@CurrentUser() user: AuthenticatedUser, @Body() input: ChangeSubscriptionDto) { return this.subscriptions.changePlan(user, input); }

  @Post('current/cancel')
  @RequirePermissions('subscription.manage')
  cancel(@CurrentUser() user: AuthenticatedUser, @Body() input: CancelSubscriptionDto) { return this.subscriptions.cancel(user, input); }

  @Post('webhooks/local')
  @Public()
  webhook(@Body() input: BillingWebhookDto, @Headers('x-billing-signature') signature?: string) { return this.subscriptions.handleWebhook(input, signature); }
}
