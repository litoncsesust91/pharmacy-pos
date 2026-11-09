import { IsString, Length } from 'class-validator';

export class CreateBranchDto {
  @IsString()
  @Length(2, 120)
  name!: string;

  @IsString()
  @Length(2, 20)
  code!: string;
}
