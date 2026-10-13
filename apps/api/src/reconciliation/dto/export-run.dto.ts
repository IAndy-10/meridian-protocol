import { IsIn, IsOptional, IsString } from 'class-validator';

export class ExportRunQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(['json', 'csv'])
  format?: 'json' | 'csv';
}
