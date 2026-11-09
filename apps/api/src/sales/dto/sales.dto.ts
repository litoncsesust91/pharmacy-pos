import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';

export class SaleLineDto {
  @IsString()
  productId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountAmount?: number;
}

export class CreateCustomerDto {
  @IsString()
  @Length(1, 80)
  firstName!: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  lastName?: string;

  @IsOptional()
  @IsString()
  @Length(3, 30)
  phone?: string;

  @IsOptional()
  @IsString()
  @Length(3, 180)
  email?: string;
}

export class CustomerQueryDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  search?: string;
}

export class CreateSaleDto {
  @IsString()
  @Length(1, 80)
  branchId!: string;

  @IsString()
  @Length(1, 80)
  saleNumber!: string;

  @IsString()
  @Length(1, 100)
  idempotencyKey!: string;

  @IsIn(['ONLINE', 'OFFLINE'])
  channel!: 'ONLINE' | 'OFFLINE';

  @IsOptional()
  @IsIn(['SUSPENDED', 'COMPLETED'])
  status?: 'SUSPENDED' | 'COMPLETED';

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  prescriptionId?: string;

  @IsOptional()
  @IsIn(['cash', 'card', 'bkash', 'nagad', 'rocket'])
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  clientCreatedAt?: string;

  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleLineDto)
  lines!: SaleLineDto[];
}

export class SaleQueryDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsIn(['COMPLETED', 'SUSPENDED'])
  status?: 'COMPLETED' | 'SUSPENDED';
}
