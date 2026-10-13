import { apiClient } from '../api-client';

// --- Types matching SPEC-C DTOs ---

export type EligibilityState = 'ELIGIBLE' | 'NOT_ELIGIBLE' | 'INDETERMINATE' | 'INVALID';

export type LinkageState =
  | 'QUALIFYING_RECORD_LINKED_WITHIN_WINDOW'
  | 'QUALIFYING_RECORD_LINKED_OUTSIDE_WINDOW'
  | 'NO_LINKED_RECORD_IN_AVAILABLE_DATA'
  | 'AMBIGUOUS_LINKAGE'
  | 'PARTIAL_OR_NONQUALIFYING_RECORD'
  | 'NOT_YET_EVALUABLE'
  | 'DATA_COVERAGE_UNKNOWN';

export type ReviewStatus = 'OPEN' | 'IN_REVIEW' | 'CLOSED_WITH_REASON' | 'REOPENED';

export interface ReconciliationDecision {
  id: string;
  screeningEventId: string;
  syntheticPatientId: string;
  encounterId: string;
  occurredAt: string;
  eligibilityState: EligibilityState;
  linkageState: LinkageState | null;
  reasonCodes: string[];
  linkedAssessmentId: string | null;
  candidateAssessmentIds: string[];
  ruleVersion: string;
  reviewStatus: ReviewStatus;
  isMature: boolean;
  coverageStatus: string | null;
}

export interface ReconciliationCounts {
  eligible: number;
  notEligible: number;
  indeterminate: number;
  invalid: number;
  mature: number;
  immature: number;
  withinWindow: number;
  outsideWindow: number;
  ambiguous: number;
  partial: number;
  absent: number;
  coverageUnknown: number;
}

export interface ReconciliationRunSummary {
  id: string;
  createdAt: string;
  asOf: string;
  configHash: string;
  engineVersion: string;
  protocolVersionId: string;
  counts: ReconciliationCounts;
}

export interface ReconciliationRun extends ReconciliationRunSummary {
  decisions: ReconciliationDecision[];
  coverageManifest: {
    locationsIncluded: string[];
    locationsOmitted: string[];
    extractionCutoff: string;
    knownMissingFeeds: string[];
    coverageStatus: string;
  } | null;
}

export interface ReviewAction {
  id: string;
  decisionId: string;
  fromStatus: ReviewStatus;
  toStatus: ReviewStatus;
  reason: string | null;
  evidenceReference: string | null;
  performedBy: string;
  performedAt: string;
}

export interface CreateReviewActionRequest {
  toStatus: ReviewStatus;
  reason?: string;
  evidenceReference?: string;
}

const basePath = (orgId: string) => `/api/organizations/${orgId}/reconciliation`;

export const reconciliationApi = {
  triggerRun: (orgId: string) =>
    apiClient.post<ReconciliationRun>(`${basePath(orgId)}/run`, {}),

  listRuns: (orgId: string) =>
    apiClient.get<ReconciliationRunSummary[]>(`${basePath(orgId)}/runs`),

  getRun: (orgId: string, runId: string) =>
    apiClient.get<ReconciliationRun>(`${basePath(orgId)}/runs/${runId}`),

  exportRun: (orgId: string, runId: string, format: 'json' | 'csv') =>
    apiClient.get<Blob>(
      `${basePath(orgId)}/runs/${runId}/export?format=${format}`,
    ),

  createReviewAction: (
    orgId: string,
    runId: string,
    decisionId: string,
    data: CreateReviewActionRequest,
  ) =>
    apiClient.post<ReviewAction>(
      `${basePath(orgId)}/runs/${runId}/decisions/${decisionId}/reviews`,
      data,
    ),

  getReviewActions: (orgId: string, runId: string, decisionId: string) =>
    apiClient.get<ReviewAction[]>(
      `${basePath(orgId)}/runs/${runId}/decisions/${decisionId}/reviews`,
    ),
};
