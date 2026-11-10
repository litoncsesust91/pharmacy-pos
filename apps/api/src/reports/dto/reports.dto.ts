import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const reportTypes = ['SALES', 'DAILY_SALES', 'MONTHLY_SALES', 'YEARLY_SALES', 'CASH', 'PROFIT', 'INVENTORY', 'LOW_STOCK', 'EXPIRY', 'REFUNDS', 'VOIDS', 'TAX'] as const;
export type ReportType = (typeof reportTypes)[number];

export class ReportQueryDto {
  @IsIn(reportTypes)
  type!: ReportType;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  batchId?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsString()
  cashierId?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  pageSize = 100;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;
}

export class ExportReportDto extends ReportQueryDto {
  @IsIn(['csv', 'pdf'])
  format!: 'csv' | 'pdf';
}
