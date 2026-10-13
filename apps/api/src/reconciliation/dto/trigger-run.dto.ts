import { IsOptional, IsString } from 'class-validator';

export class TriggerRunDto {
  @IsOptional()
  @IsString()
  protocolVersionId?: string;

  @IsOptional()
  @IsString()
  coverageManifestId?: string;
}
