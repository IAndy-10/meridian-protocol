/**
 * AegisBrain reconciliation domain types.
 *
 * Shared between API and Web so eligibility/linkage states are a compile-time
 * contract, not duplicated string literals.
 */

export const EligibilityState = {
  ELIGIBLE: 'ELIGIBLE',
  NOT_ELIGIBLE: 'NOT_ELIGIBLE',
  INDETERMINATE: 'INDETERMINATE',
  INVALID: 'INVALID',
} as const;
export type EligibilityState =
  (typeof EligibilityState)[keyof typeof EligibilityState];

export const LinkageState = {
  QUALIFYING_RECORD_LINKED_WITHIN_WINDOW: 'QUALIFYING_RECORD_LINKED_WITHIN_WINDOW',
  QUALIFYING_RECORD_LINKED_OUTSIDE_WINDOW: 'QUALIFYING_RECORD_LINKED_OUTSIDE_WINDOW',
  NO_LINKED_RECORD_IN_AVAILABLE_DATA: 'NO_LINKED_RECORD_IN_AVAILABLE_DATA',
  AMBIGUOUS_LINKAGE: 'AMBIGUOUS_LINKAGE',
  PARTIAL_OR_NONQUALIFYING_RECORD: 'PARTIAL_OR_NONQUALIFYING_RECORD',
  NOT_YET_EVALUABLE: 'NOT_YET_EVALUABLE',
  DATA_COVERAGE_UNKNOWN: 'DATA_COVERAGE_UNKNOWN',
} as const;
export type LinkageState = (typeof LinkageState)[keyof typeof LinkageState];

export const ReviewStatus = {
  OPEN: 'OPEN',
  IN_REVIEW: 'IN_REVIEW',
  CLOSED_WITH_REASON: 'CLOSED_WITH_REASON',
  REOPENED: 'REOPENED',
} as const;
export type ReviewStatus = (typeof ReviewStatus)[keyof typeof ReviewStatus];

export const SourceArtifactKind = {
  PUBLICATION: 'PUBLICATION',
  SYNTHETIC_PROCEDURE: 'SYNTHETIC_PROCEDURE',
  LOCAL_APPROVED_POLICY: 'LOCAL_APPROVED_POLICY',
} as const;
export type SourceArtifactKind =
  (typeof SourceArtifactKind)[keyof typeof SourceArtifactKind];

export interface ReconciliationDecision {
  screeningEventId: string;
  eligibility: EligibilityState;
  eligibilityReason: string;
  linkage: LinkageState | null;
  linkageReason: string | null;
  linkedAssessmentId: string | null;
  candidateAssessmentIds: string[];
  isMature: boolean;
  protocolVersionId: string | null;
  measureDefinitionId: string | null;
}

export interface ReconciliationSummary {
  totalScreens: number;
  eligible: number;
  matureEligible: number;
  withinWindow: number;
  outsideWindow: number;
  ambiguous: number;
  immature: number;
  partial: number;
  absentLink: number;
  coverageUnknown: number;
  notEligible: number;
  indeterminate: number;
}
