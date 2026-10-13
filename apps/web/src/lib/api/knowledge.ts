import { apiClient } from '../api-client';

export interface KnowledgeDocument {
  id: string;
  organizationId: string;
  createdById: string;
  title: string;
  hydraSourceId: string;
  indexingStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface IngestDocumentRequest {
  title: string;
  content: string;
  artifactKind?: string;
  linkedProtocolVersions?: string[];
  topicTags?: string[];
  publicationDate?: string;
  sectionHeading?: string;
  metadata?: Record<string, unknown>;
}

const basePath = (orgId: string) => `/api/organizations/${orgId}/knowledge`;

export const knowledgeApi = {
  list: (orgId: string) =>
    apiClient.get<{ items: KnowledgeDocument[]; total: number }>(basePath(orgId)),

  ingest: (orgId: string, data: IngestDocumentRequest) =>
    apiClient.post<KnowledgeDocument>(`${basePath(orgId)}/ingest`, data),

  refreshStatus: (orgId: string, docId: string) =>
    apiClient.post<KnowledgeDocument>(`${basePath(orgId)}/${docId}/refresh-status`, {}),

  remove: (orgId: string, docId: string) =>
    apiClient.delete(`${basePath(orgId)}/${docId}`),
};
