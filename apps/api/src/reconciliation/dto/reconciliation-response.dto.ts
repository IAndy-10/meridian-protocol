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

export interface ReconciliationRunSummaryDto {
  id: string;
  createdAt: string;
  asOf: string;
  configHash: string;
  engineVersion: string;
  protocolVersionId: string;
  counts: ReconciliationCounts;
}

export interface ReconciliationRunDetailDto extends ReconciliationRunSummaryDto {
  decisions: unknown[];
  coverageManifest: unknown | null;
  knowledgeSnapshot: unknown | null;
}

export interface ReconciliationRunListDto {
  items: ReconciliationRunSummaryDto[];
  total: number;
}
