import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class NotificationQueryDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  unreadOnly?: boolean;
}

export class UpdateNotificationPreferenceDto {
  @IsOptional()
  @IsBoolean()
  inApp?: boolean;

  @IsOptional()
  @IsBoolean()
  email?: boolean;

  @IsOptional()
  @IsBoolean()
  push?: boolean;

  @IsOptional()
  @IsBoolean()
  lowStock?: boolean;

  @IsOptional()
  @IsBoolean()
  expiry?: boolean;

  @IsOptional()
  @IsBoolean()
  summaries?: boolean;
}

export class EnqueueJobDto {
  @IsIn(['LOW_STOCK', 'NEAR_EXPIRY', 'EXPIRED_STOCK', 'DAILY_SALES_SUMMARY', 'SCHEDULED_REPORT', 'REPORT_EXPORT'])
  jobType!: string;

  @IsString()
  @Length(1, 120)
  dedupeKey!: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}

export class CreateReportScheduleDto {
  @IsString()
  @Length(1, 120)
  name!: string;

  @IsIn(['DAILY_SALES_SUMMARY', 'LOW_STOCK', 'EXPIRY'])
  reportType!: string;

  @IsString()
  @Length(1, 80)
  cron!: string;

  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;

  @IsOptional()
  @IsDateString()
  nextRunAt?: string;
}
