import { IsIn, IsOptional, IsString, Length } from 'class-validator';

export class ChangeSubscriptionDto {
  @IsString()
  @Length(1, 60)
  planKey!: string;
}

export class CancelSubscriptionDto {
  @IsOptional()
  @IsString()
  @Length(0, 240)
  reason?: string;
}

export class BillingWebhookDto {
  @IsString()
  @Length(1, 160)
  eventId!: string;

  @IsString()
  @Length(1, 80)
  eventType!: string;

  @IsString()
  @Length(1, 120)
  tenantId!: string;

  @IsOptional()
  @IsIn(['active', 'suspended', 'canceled'])
  status?: string;
}
