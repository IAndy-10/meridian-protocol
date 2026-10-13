/**
 * Input types for the pure reconciliation engine.
 * These mirror Prisma models but are plain objects with no ORM dependency.
 */

export interface ScreeningEventInput {
  id: string;
  organizationId: string;
  syntheticPatientId: string;
  encounterId: string;
  occurredAt: Date;
  recordedAt: Date;
  ageAtEvent: number;
  setting: string;
  instrumentName: string;
  instrumentVersion: string;
  item9Value: number | null;
  assessmentRequired: boolean | null;
  eligibilityRuleVersion: string;
  sourceRecordId: string;
  sourceSystem: string;
  sourceLocation: string | null;
  provenanceHash: string;
}

export interface AssessmentEventInput {
  id: string;
  organizationId: string;
  syntheticPatientId: string;
  encounterId: string;
  triggeringScreenId: string | null;
  performedAt: Date;
  recordedAt: Date;
  instrumentName: string;
  instrumentVersion: string;
  documentationStatus: string;
  documentedCompletionFlag: boolean | null;
  sourceRecordId: string;
  sourceSystem: string;
  sourceLocation: string | null;
  provenanceHash: string;
}

export interface ProtocolVersionInput {
  id: string;
  organizationId: string;
  version: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  timezone: string;
  calendarVersion: string;
  measureDefinitions: MeasureDefinitionInput[];
}

export interface MeasureDefinitionInput {
  id: string;
  version: string;
  protocolVersionId: string;
  populationMinAge: number | null;
  settingFilter: string;
  eligibilityRule: string;
  qualifyingAssessment: string;
  linkageRules: string;
  reportingIntervalDays: number;
  timeAnchor: string;
  boundaryInclusivity: string;
  duplicatePolicy: string;
  exclusionPolicy: string;
}

export interface CoverageManifestInput {
  locationsIncluded: string[];
  locationsOmitted: string[];
  extractionCutoff: Date;
  dataWatermark: Date;
  knownMissingFeeds: string[];
  coverageStatus: string;
}

export interface BusinessDayCalendar {
  timezone: string;
  holidays: string[];
  weekendDays: number[];
}

export interface ReconciliationInput {
  organizationId: string;
  screens: ScreeningEventInput[];
  assessments: AssessmentEventInput[];
  protocolVersions: ProtocolVersionInput[];
  coverage: CoverageManifestInput;
  calendar: BusinessDayCalendar;
  asOf: Date;
  engineVersion: string;
}
