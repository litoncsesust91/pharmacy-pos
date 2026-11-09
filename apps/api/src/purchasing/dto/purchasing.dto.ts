import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class UpdateSupplierTermsDto {
  @IsOptional()
  @IsString()
  @Length(2, 160)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(3, 30)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  paymentTermsDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  creditLimit?: number;
}

export class PurchaseOrderLineDto {
  @IsString()
  productId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitCost!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  taxRate!: number;
}

export class CreatePurchaseOrderDto {
  @IsString()
  @Length(1, 80)
  branchId!: string;

  @IsString()
  @Length(1, 80)
  supplierId!: string;

  @IsString()
  @Length(1, 80)
  orderNumber!: string;

  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderLineDto)
  lines!: PurchaseOrderLineDto[];
}

export class ReviewPurchaseOrderDto {
  @IsBoolean()
  approved!: boolean;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  note?: string;
}

export class ReceiveLineDto {
  @IsString()
  purchaseOrderLineId!: string;

  @IsString()
  @Length(1, 80)
  batchNumber!: string;

  @IsOptional()
  @IsDateString()
  manufacturingDate?: string;

  @IsDateString()
  expiryDate!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitCost!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  sellingPrice!: number;
}

export class ReceivePurchaseOrderDto {
  @IsString()
  @Length(1, 80)
  receiptNumber!: string;

  @IsString()
  @Length(1, 100)
  idempotencyKey!: string;

  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiveLineDto)
  lines!: ReceiveLineDto[];
}

export class PurchaseOrderQueryDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class PurchaseReturnLineDto {
  @IsString()
  batchId!: string;

  @IsOptional()
  @IsString()
  purchaseOrderLineId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreatePurchaseReturnDto {
  @IsString()
  @Length(1, 80)
  branchId!: string;

  @IsString()
  @Length(1, 80)
  supplierId!: string;

  @IsOptional()
  @IsString()
  purchaseOrderId?: string;

  @IsString()
  @Length(1, 80)
  returnNumber!: string;

  @IsString()
  @Length(1, 500)
  reason!: string;

  @IsString()
  @Length(1, 100)
  idempotencyKey!: string;

  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseReturnLineDto)
  lines!: PurchaseReturnLineDto[];
}

export class ReviewPurchaseReturnDto {
  @IsBoolean()
  approved!: boolean;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  note?: string;
}

export class PaySupplierDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsString()
  @Length(1, 100)
  idempotencyKey!: string;
}
