import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from "class-validator";

export class CreateBatchDto {
  @IsString()
  @Length(1, 80)
  productId!: string;

  @IsString()
  @Length(1, 80)
  branchId!: string;

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
  @Min(0)
  purchaseCost!: number;

  @Type(() => Number)
  @Min(0)
  sellingPrice!: number;

  @IsString()
  @Length(1, 100)
  idempotencyKey!: string;
}

export class InventoryQueryDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  productId?: string;
}

export class AllocateStockDto {
  @IsString()
  productId!: string;

  @IsString()
  branchId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsString()
  @Length(1, 100)
  idempotencyKey!: string;
}

export class StockMovementDto {
  @IsString()
  batchId!: string;

  @IsIn(["REFUND", "ADJUSTMENT", "DAMAGE", "EXPIRY"])
  movementType!: "REFUND" | "ADJUSTMENT" | "DAMAGE" | "EXPIRY";

  @Type(() => Number)
  @IsInt()
  quantity!: number;

  @IsString()
  @Length(1, 100)
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  reason?: string;
}

export class UpdateBatchStatusDto {
  @IsIn(["AVAILABLE", "RECALLED", "QUARANTINED"])
  status!: "AVAILABLE" | "RECALLED" | "QUARANTINED";
}
