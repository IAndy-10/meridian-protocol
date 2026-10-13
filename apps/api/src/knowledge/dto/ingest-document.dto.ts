import { IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class IngestDocumentDto {
  @IsString()
  @MinLength(1, { message: 'Title must be at least 1 character' })
  @MaxLength(255, { message: 'Title must be less than 255 characters' })
  title: string;

  @IsString()
  @MinLength(1, { message: 'Content must not be empty' })
  content: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
