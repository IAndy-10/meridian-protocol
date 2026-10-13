export class KnowledgeDocumentResponseDto {
  id: string;
  organizationId: string;
  createdById: string;
  title: string;
  hydraSourceId: string;
  indexingStatus: string;
  createdAt: string;
  updatedAt: string;
}

export class KnowledgeDocumentListResponseDto {
  items: KnowledgeDocumentResponseDto[];
  total: number;
}

export class KnowledgeQueryResultDto {
  chunks: Array<{
    text: string;
    sourceId: string;
    score: number;
  }>;
  graphContext?: {
    queryPaths: Array<{
      from: string;
      to: string;
      relation: string;
      weight: number;
    }>;
    chunkRelations: Array<{
      sourceChunkId: string;
      targetChunkId: string;
      relation: string;
      sourceText?: string;
      targetText?: string;
    }>;
  };
}
