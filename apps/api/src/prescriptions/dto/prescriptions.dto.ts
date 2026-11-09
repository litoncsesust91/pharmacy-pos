import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class PrescriptionLineDto {
  @IsString()
  productId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  authorizedQuantity?: number;

  @IsOptional()
  @IsString()
  @Length(1, 300)
  instructions?: string;
}

export class CreatePrescriptionDto {
  @IsString()
  customerId!: string;

  @IsString()
  @Length(1, 80)
  referenceNumber!: string;

  @IsString()
  @Length(2, 160)
  prescriberName!: string;

  @IsOptional()
  @IsString()
  @Length(2, 80)
  prescriberLicense?: string;

  @IsDateString()
  issuedAt!: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  notes?: string;

  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PrescriptionLineDto)
  lines!: PrescriptionLineDto[];
}

export class ReviewPrescriptionDto {
  @IsBoolean()
  approved!: boolean;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  reason?: string;
}

export class PrescriptionQueryDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsIn(['PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'EXPIRED'])
  status?: string;
}

export class CreatePrescriptionDocumentDto {
  @IsString()
  @Length(1, 180)
  fileName!: string;

  @IsString()
  @IsIn(['application/pdf', 'image/jpeg', 'image/png'])
  mimeType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_485_760)
  sizeBytes!: number;

  @IsString()
  @Length(64, 64)
  sha256!: string;
}
