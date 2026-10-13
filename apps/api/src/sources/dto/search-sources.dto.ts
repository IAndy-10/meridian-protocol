import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class SearchSourcesDto {
  @IsString()
  @MinLength(1, { message: 'Query must not be empty' })
  query: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  maxResults?: number;
}
