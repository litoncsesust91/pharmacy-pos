import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

export class CreateRegisterDto {
  @IsString()
  @Length(1, 80)
  branchId!: string;

  @IsString()
  @Length(1, 80)
  name!: string;

  @IsString()
  @Length(1, 30)
  code!: string;
}

export class OpenSessionDto {
  @IsString()
  registerId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  openingFloat!: number;
}

export class CashMovementDto {
  @IsIn(['CASH_IN', 'CASH_OUT'])
  movementType!: 'CASH_IN' | 'CASH_OUT';

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsString()
  @Length(1, 300)
  reason!: string;

  @IsString()
  @Length(1, 100)
  idempotencyKey!: string;
}

export class CreatePaymentDto {
  @IsString()
  saleId!: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsIn(['cash', 'card', 'bkash', 'nagad', 'rocket'])
  method!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsString()
  @Length(1, 100)
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  @Length(1, 160)
  providerReference?: string;
}

export class CloseSessionDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  countedCash!: number;

  @IsOptional()
  @IsString()
  @Length(1, 300)
  note?: string;
}

export class CreateRefundDto {
  @IsString()
  saleId!: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsString()
  @Length(1, 300)
  reason!: string;

  @IsString()
  @Length(1, 100)
  idempotencyKey!: string;
}

export class ReviewRefundDto {
  @IsBoolean()
  approved!: boolean;
}

export class ApproveCloseDto {
  @IsBoolean()
  approved!: boolean;
}

export class PaymentWebhookDto {
  @IsString()
  provider!: string;

  @IsString()
  eventId!: string;

  @IsString()
  paymentId!: string;

  @IsIn(['CONFIRMED', 'FAILED'])
  status!: 'CONFIRMED' | 'FAILED';
}
