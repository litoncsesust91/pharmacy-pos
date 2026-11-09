import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsArray,
  ArrayMaxSize,
  IsEmail,
  IsIn,
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

export class CreateNamedCatalogDto {
  @IsString()
  @Length(2, 120)
  name!: string;
}

export class CreateSupplierDto {
  @IsString()
  @Length(2, 160)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(3, 30)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

export class CreateProductDto {
  @IsString()
  @Length(2, 180)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(2, 180)
  genericName?: string;

  @IsOptional()
  @IsString()
  @Length(2, 80)
  dosageForm?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  strength?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  packSize?: number;

  @IsOptional()
  @IsString()
  @Length(1, 30)
  unit?: string;

  @IsString()
  @Length(1, 80)
  @Matches(/^[A-Za-z0-9._/-]+$/)
  sku!: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  taxCategory?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  purchasePrice!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  sellingPrice!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minimumStock?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  reorderQuantity?: number;

  @IsOptional()
  @IsBoolean()
  prescriptionRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  controlledDrug?: boolean;

  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @IsString({ each: true })
  @Matches(/^[A-Za-z0-9._/-]+$/, { each: true })
  barcodes?: string[];

  @IsOptional()
  @IsString({ each: true })
  supplierIds?: string[];
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @Length(2, 180)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(2, 180)
  genericName?: string;

  @IsOptional()
  @IsString()
  @Length(2, 80)
  dosageForm?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  strength?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  packSize?: number;

  @IsOptional()
  @IsString()
  @Length(1, 30)
  unit?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  @Matches(/^[A-Za-z0-9._/-]+$/)
  sku?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  taxCategory?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  purchasePrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  sellingPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minimumStock?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  reorderQuantity?: number;

  @IsOptional()
  @IsBoolean()
  prescriptionRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  controlledDrug?: boolean;

  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @IsString({ each: true })
  @Matches(/^[A-Za-z0-9._/-]+$/, { each: true })
  barcodes?: string[];

  @IsOptional()
  @IsString({ each: true })
  supplierIds?: string[];
}

export class ProductQueryDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  search?: string;

  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsIn(['name', 'sku', 'createdAt', 'sellingPrice'])
  sortBy?: 'name' | 'sku' | 'createdAt' | 'sellingPrice';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}

export class ProductImportDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CreateProductDto)
  rows!: CreateProductDto[];
}
