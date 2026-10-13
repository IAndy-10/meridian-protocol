export class SourceArtifactResponseDto {
  id: string;
  organizationId: string;
  kind: string;
  title: string;
  url: string | null;
  excerpt: string | null;
  sectionLocator: string | null;
  contentHash: string;
  hydraSourceId: string | null;
  createdAt: string;
}

export class SourceArtifactDetailDto extends SourceArtifactResponseDto {
  storedText: string | null;
  hydraChunks?: Array<{
    text: string;
    sourceId: string;
    score: number;
  }>;
}

export class SourceArtifactListDto {
  items: SourceArtifactResponseDto[];
  total: number;
}
