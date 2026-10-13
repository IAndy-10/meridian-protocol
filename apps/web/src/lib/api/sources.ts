import { apiClient } from '../api-client';

export interface SourceArtifact {
  id: string;
  organizationId: string;
  kind: 'PUBLICATION' | 'SYNTHETIC_PROCEDURE';
  title: string;
  url: string | null;
  contentHash: string;
  hydraSourceId: string | null;
  excerpt: string | null;
  isSynthetic: boolean;
  createdAt: string;
}

export interface SourceSearchResult {
  sourceArtifactId: string;
  title: string;
  passage: string;
  sectionLocator: string | null;
  score: number;
}

export interface SourceSearchRequest {
  query: string;
  limit?: number;
}

const basePath = (orgId: string) => `/api/organizations/${orgId}/sources`;

export const sourcesApi = {
  list: (orgId: string) =>
    apiClient.get<SourceArtifact[]>(basePath(orgId)),

  get: (orgId: string, sourceId: string) =>
    apiClient.get<SourceArtifact & { fullText?: string }>(
      `${basePath(orgId)}/${sourceId}`,
    ),

  search: (orgId: string, data: SourceSearchRequest) =>
    apiClient.post<SourceSearchResult[]>(`${basePath(orgId)}/search`, data),
};
