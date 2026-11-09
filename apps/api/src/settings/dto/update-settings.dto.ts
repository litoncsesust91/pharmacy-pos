import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  Matches,
  ValidateNested,
} from 'class-validator';

export class PaymentMethodDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9_-]{1,31}$/)
  code!: string;

  @IsString()
  @Length(2, 80)
  displayName!: string;

  @IsBoolean()
  enabled!: boolean;

  @IsInt()
  @Min(0)
  @Max(100)
  sortOrder!: number;
}

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/)
  countryCode?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/)
  currencyCode?: string;

  @IsOptional()
  @IsString()
  @Length(3, 80)
  timezone?: string;

  @IsOptional()
  @IsString()
  @Length(2, 20)
  locale?: string;

  @IsOptional()
  @IsBoolean()
  taxEnabled?: boolean;

  @IsOptional()
  @IsString()
  @Length(2, 40)
  taxName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  taxRate?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  expiryWarningDays?: number;

  @IsOptional()
  @IsBoolean()
  blockExpiredProducts?: boolean;

  @IsOptional()
  @IsBoolean()
  blockNearExpiryProducts?: boolean;

  @IsOptional()
  @IsBoolean()
  prescriptionRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  controlledDrugsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  prescriptionApprovalRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  controlledApprovalRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  offlineHighRiskSalesAllowed?: boolean;

  @IsOptional()
  @IsString()
  @Length(1, 12)
  receiptPrefix?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PaymentMethodDto)
  paymentMethods?: PaymentMethodDto[];
}
