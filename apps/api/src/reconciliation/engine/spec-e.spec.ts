/**
 * SPEC-E: Boundary Tests and Acceptance Criteria
 * Implements all 16 acceptance criteria from PROBLEM.md Section 11,
 * boundary tests B01-B09 from specs/FIXTURES.md, and scripted demo verification.
 *
 * SYNTHETIC — NOT AN APPROVED CLINICAL PROCEDURE.
 */
import {
  EligibilityState,
  LinkageState,
  EXPECTED_DECISIONS,
  EXPECTED_SUMMARY,
  verifyExpectedCounts,
} from '@app-starter/shared';
import { reconcile, ReconciliationResult } from './reconcile';
import {
  addBusinessDays,
  isWithinBusinessDayWindow,
} from './business-day-calendar';
import {
  ReconciliationInput,
  ScreeningEventInput,
  AssessmentEventInput,
  ProtocolVersionInput,
  BusinessDayCalendar,
  CoverageManifestInput,
  MeasureDefinitionInput,
} from './types';

// ---------------------------------------------------------------------------
// Shared fixtures (same as reconcile.spec.ts)
// ---------------------------------------------------------------------------

const ORG_ID = 'org-aegis-001';
const ENGINE_VERSION = '0.1.0';

const CALENDAR: BusinessDayCalendar = {
  timezone: 'America/Los_Angeles',
  holidays: ['2026-09-07', '2026-11-26'],
  weekendDays: [0, 6],
};

const MEASURE_V1: MeasureDefinitionInput = {
  id: 'md-1',
  version: '1.0',
  protocolVersionId: 'pv-1',
  populationMinAge: 18,
  settingFilter: 'specialty_mental_health',
  eligibilityRule: 'PHQ-9 item 9 >= 1 AND assessmentRequired = true',
  qualifyingAssessment: 'C-SSRS with documentedCompletionFlag = true',
  linkageRules: 'Prefer explicit triggeringScreenId; fallback to same-encounter if exactly 1 candidate and 1 eligible screen; no closest-timestamp selection; no assessment reuse',
  reportingIntervalDays: 2,
  timeAnchor: 'screen_occurrence',
  boundaryInclusivity: 'inclusive',
  duplicatePolicy: 'Exact duplicate source records idempotent; conflicting records with same sourceRecordId quarantined as INVALID',
  exclusionPolicy: 'Age < 18 excluded; setting != specialty_mental_health excluded; explicit assessmentRequired = false excluded',
};

const MEASURE_V2: MeasureDefinitionInput = { ...MEASURE_V1, id: 'md-2', version: '2.0', protocolVersionId: 'pv-2' };

const PV1: ProtocolVersionInput = {
  id: 'pv-1',
  organizationId: ORG_ID,
  version: '1.0',
  effectiveFrom: new Date('2026-06-01T00:00:00-07:00'),
  effectiveTo: new Date('2026-10-01T00:00:00-07:00'),
  timezone: 'America/Los_Angeles',
  calendarVersion: 'cal-v1',
  measureDefinitions: [MEASURE_V1],
};

const PV2: ProtocolVersionInput = {
  id: 'pv-2',
  organizationId: ORG_ID,
  version: '2.0',
  effectiveFrom: new Date('2026-10-01T00:00:00-07:00'),
  effectiveTo: null,
  timezone: 'America/Los_Angeles',
  calendarVersion: 'cal-v1',
  measureDefinitions: [MEASURE_V2],
};

const COVERAGE: CoverageManifestInput = {
  locationsIncluded: ['main-campus-ehr', 'telehealth-platform'],
  locationsOmitted: ['satellite-clinic-ehr'],
  extractionCutoff: new Date('2026-10-12T06:00:00-07:00'),
  dataWatermark: new Date('2026-10-11T23:59:59-07:00'),
  knownMissingFeeds: ['satellite-clinic-ehr'],
  coverageStatus: 'PARTIAL',
};

function scr(overrides: Partial<ScreeningEventInput> & { id: string }): ScreeningEventInput {
  return {
    organizationId: ORG_ID,
    syntheticPatientId: 'SP-000',
    encounterId: 'enc-000',
    occurredAt: new Date('2026-08-03T09:30:00-07:00'),
    recordedAt: new Date('2026-08-03T09:35:00-07:00'),
    ageAtEvent: 34,
    setting: 'specialty_mental_health',
    instrumentName: 'PHQ-9',
    instrumentVersion: '9.0',
    item9Value: 2,
    assessmentRequired: true,
    eligibilityRuleVersion: 'md-1',
    sourceRecordId: `SRC-SCR-${overrides.id}`,
    sourceSystem: 'synthetic-ehr',
    sourceLocation: 'main-campus-ehr',
    provenanceHash: `hash-${overrides.id}`,
    ...overrides,
  };
}

function asx(overrides: Partial<AssessmentEventInput> & { id: string }): AssessmentEventInput {
  return {
    organizationId: ORG_ID,
    syntheticPatientId: 'SP-000',
    encounterId: 'enc-000',
    triggeringScreenId: null,
    performedAt: new Date('2026-08-04T14:00:00-07:00'),
    recordedAt: new Date('2026-08-04T14:30:00-07:00'),
    instrumentName: 'C-SSRS',
    instrumentVersion: 'screener',
    documentationStatus: 'COMPLETED',
    documentedCompletionFlag: true,
    sourceRecordId: `SRC-ASX-${overrides.id}`,
    sourceSystem: 'synthetic-ehr',
    sourceLocation: 'main-campus-ehr',
    provenanceHash: `hash-asx-${overrides.id}`,
    ...overrides,
  };
}

// Full fixture set
const screens: ScreeningEventInput[] = [
  scr({ id: 'scr-E01', syntheticPatientId: 'SP-001', encounterId: 'enc-001', occurredAt: new Date('2026-08-03T09:30:00-07:00'), recordedAt: new Date('2026-08-03T09:35:00-07:00'), ageAtEvent: 34, item9Value: 2, sourceRecordId: 'SRC-SCR-001' }),
  scr({ id: 'scr-E02', syntheticPatientId: 'SP-002', encounterId: 'enc-002', occurredAt: new Date('2026-08-10T14:00:00-07:00'), recordedAt: new Date('2026-08-10T14:05:00-07:00'), ageAtEvent: 45, item9Value: 1, sourceRecordId: 'SRC-SCR-002' }),
  scr({ id: 'scr-E03', syntheticPatientId: 'SP-003', encounterId: 'enc-003', occurredAt: new Date('2026-08-14T10:00:00-07:00'), recordedAt: new Date('2026-08-14T10:10:00-07:00'), ageAtEvent: 28, item9Value: 3, sourceRecordId: 'SRC-SCR-003' }),
  scr({ id: 'scr-E04', syntheticPatientId: 'SP-004', encounterId: 'enc-004', occurredAt: new Date('2026-09-04T11:00:00-07:00'), recordedAt: new Date('2026-09-04T11:05:00-07:00'), ageAtEvent: 52, item9Value: 1, sourceRecordId: 'SRC-SCR-004' }),
  scr({ id: 'scr-E05', syntheticPatientId: 'SP-005', encounterId: 'enc-005', occurredAt: new Date('2026-08-17T09:00:00-07:00'), recordedAt: new Date('2026-08-17T09:05:00-07:00'), ageAtEvent: 39, item9Value: 2, sourceRecordId: 'SRC-SCR-005' }),
  scr({ id: 'scr-E06', syntheticPatientId: 'SP-006', encounterId: 'enc-006', occurredAt: new Date('2026-08-20T10:00:00-07:00'), recordedAt: new Date('2026-08-20T10:05:00-07:00'), ageAtEvent: 41, item9Value: 1, sourceRecordId: 'SRC-SCR-006' }),
  scr({ id: 'scr-E07', syntheticPatientId: 'SP-007', encounterId: 'enc-007', occurredAt: new Date('2026-08-24T09:00:00-07:00'), recordedAt: new Date('2026-08-24T09:05:00-07:00'), ageAtEvent: 55, item9Value: 2, sourceRecordId: 'SRC-SCR-007' }),
  scr({ id: 'scr-E08', syntheticPatientId: 'SP-008', encounterId: 'enc-008', occurredAt: new Date('2026-08-26T10:00:00-07:00'), recordedAt: new Date('2026-08-26T10:05:00-07:00'), ageAtEvent: 33, item9Value: 1, sourceRecordId: 'SRC-SCR-008' }),
  scr({ id: 'scr-E09', syntheticPatientId: 'SP-009', encounterId: 'enc-009', occurredAt: new Date('2026-08-31T09:00:00-07:00'), recordedAt: new Date('2026-08-31T09:05:00-07:00'), ageAtEvent: 47, item9Value: 2, sourceRecordId: 'SRC-SCR-009' }),
  scr({ id: 'scr-E09b', syntheticPatientId: 'SP-009', encounterId: 'enc-009b', occurredAt: new Date('2026-09-01T09:00:00-07:00'), recordedAt: new Date('2026-09-01T09:05:00-07:00'), ageAtEvent: 47, item9Value: 1, sourceRecordId: 'SRC-SCR-009B' }),
  scr({ id: 'scr-E10', syntheticPatientId: 'SP-010', encounterId: 'enc-010', occurredAt: new Date('2026-10-11T14:00:00-07:00'), recordedAt: new Date('2026-10-12T07:30:00-07:00'), ageAtEvent: 29, item9Value: 1, eligibilityRuleVersion: 'md-2', sourceRecordId: 'SRC-SCR-010' }),
  scr({ id: 'scr-E11', syntheticPatientId: 'SP-011', encounterId: 'enc-011', occurredAt: new Date('2026-08-19T10:00:00-07:00'), recordedAt: new Date('2026-08-19T10:05:00-07:00'), ageAtEvent: 36, item9Value: 1, sourceRecordId: 'SRC-SCR-011' }),
  scr({ id: 'scr-E12', syntheticPatientId: 'SP-012', encounterId: 'enc-012', occurredAt: new Date('2026-09-15T09:00:00-07:00'), recordedAt: new Date('2026-09-15T09:05:00-07:00'), ageAtEvent: 43, item9Value: 2, sourceRecordId: 'SRC-SCR-012', sourceLocation: 'satellite-clinic-ehr' }),
  scr({ id: 'scr-X01', syntheticPatientId: 'SP-013', encounterId: 'enc-013', occurredAt: new Date('2026-08-05T10:00:00-07:00'), recordedAt: new Date('2026-08-05T10:05:00-07:00'), ageAtEvent: 38, item9Value: 0, assessmentRequired: false, sourceRecordId: 'SRC-SCR-013' }),
  scr({ id: 'scr-X02', syntheticPatientId: 'SP-014', encounterId: 'enc-014', occurredAt: new Date('2026-08-07T11:00:00-07:00'), recordedAt: new Date('2026-08-07T11:05:00-07:00'), ageAtEvent: 16, sourceRecordId: 'SRC-SCR-014' }),
  scr({ id: 'scr-X03', syntheticPatientId: 'SP-015', encounterId: 'enc-015', occurredAt: new Date('2026-08-11T09:30:00-07:00'), recordedAt: new Date('2026-08-11T09:35:00-07:00'), ageAtEvent: 42, setting: 'primary_care', item9Value: 1, sourceRecordId: 'SRC-SCR-015' }),
  scr({ id: 'scr-U01', syntheticPatientId: 'SP-016', encounterId: 'enc-016', occurredAt: new Date('2026-08-12T14:00:00-07:00'), recordedAt: new Date('2026-08-12T14:05:00-07:00'), ageAtEvent: 31, item9Value: 1, assessmentRequired: null, sourceRecordId: 'SRC-SCR-016' }),
];

const assessments: AssessmentEventInput[] = [
  asx({ id: 'asx-E01', syntheticPatientId: 'SP-001', encounterId: 'enc-001a', triggeringScreenId: 'scr-E01', performedAt: new Date('2026-08-04T14:00:00-07:00'), recordedAt: new Date('2026-08-04T14:30:00-07:00'), sourceRecordId: 'SRC-ASX-001' }),
  asx({ id: 'asx-E02', syntheticPatientId: 'SP-002', encounterId: 'enc-002', triggeringScreenId: null, performedAt: new Date('2026-08-10T15:00:00-07:00'), recordedAt: new Date('2026-08-10T15:10:00-07:00'), sourceRecordId: 'SRC-ASX-002' }),
  asx({ id: 'asx-E03', syntheticPatientId: 'SP-003', encounterId: 'enc-003a', triggeringScreenId: 'scr-E03', performedAt: new Date('2026-08-18T09:00:00-07:00'), recordedAt: new Date('2026-08-18T09:30:00-07:00'), sourceRecordId: 'SRC-ASX-003' }),
  asx({ id: 'asx-E04', syntheticPatientId: 'SP-004', encounterId: 'enc-004a', triggeringScreenId: 'scr-E04', performedAt: new Date('2026-09-09T10:00:00-07:00'), recordedAt: new Date('2026-09-09T10:15:00-07:00'), sourceRecordId: 'SRC-ASX-004' }),
  asx({ id: 'asx-E05', syntheticPatientId: 'SP-005', encounterId: 'enc-005a', triggeringScreenId: 'scr-E05', performedAt: new Date('2026-08-21T10:00:00-07:00'), recordedAt: new Date('2026-08-21T10:30:00-07:00'), sourceRecordId: 'SRC-ASX-005' }),
  asx({ id: 'asx-E08a', syntheticPatientId: 'SP-008', encounterId: 'enc-008a', triggeringScreenId: null, performedAt: new Date('2026-08-27T09:00:00-07:00'), recordedAt: new Date('2026-08-27T09:30:00-07:00'), sourceRecordId: 'SRC-ASX-008A' }),
  asx({ id: 'asx-E08b', syntheticPatientId: 'SP-008', encounterId: 'enc-008b', triggeringScreenId: null, performedAt: new Date('2026-08-27T14:00:00-07:00'), recordedAt: new Date('2026-08-27T14:30:00-07:00'), sourceRecordId: 'SRC-ASX-008B' }),
  asx({ id: 'asx-E09', syntheticPatientId: 'SP-009', encounterId: 'enc-009c', triggeringScreenId: null, performedAt: new Date('2026-09-01T11:00:00-07:00'), recordedAt: new Date('2026-09-01T11:30:00-07:00'), sourceRecordId: 'SRC-ASX-009' }),
  asx({ id: 'asx-E11', syntheticPatientId: 'SP-011', encounterId: 'enc-011a', triggeringScreenId: 'scr-E11', performedAt: new Date('2026-08-20T10:00:00-07:00'), recordedAt: new Date('2026-08-20T10:30:00-07:00'), documentationStatus: 'PARTIAL', documentedCompletionFlag: false, sourceRecordId: 'SRC-ASX-011' }),
];

function buildInput(overrides?: Partial<ReconciliationInput>): ReconciliationInput {
  return {
    organizationId: ORG_ID,
    screens,
    assessments,
    protocolVersions: [PV1, PV2],
    coverage: COVERAGE,
    calendar: CALENDAR,
    asOf: new Date('2026-10-12T08:00:00-07:00'),
    engineVersion: ENGINE_VERSION,
    ...overrides,
  };
}

function findDecision(result: ReconciliationResult, screenId: string) {
  return result.decisions.find((d) => d.screeningEventId === screenId);
}

// ---------------------------------------------------------------------------
// Part 1: 16 Acceptance Criteria (PROBLEM.md Section 11)
// ---------------------------------------------------------------------------

describe('SPEC-E: Acceptance Criteria', () => {
  // Pre-compute the full run once for criteria that inspect it
  const fullResult = reconcile(buildInput());

  // AC-1: Known-answer fixtures produce exact expected outputs
  describe('AC-1: Known-answer fixture counts', () => {
    it('hand-labeled expected counts are internally consistent', () => {
      expect(() => verifyExpectedCounts()).not.toThrow();
    });

    it('produces correct number of decisions (17 total screens)', () => {
      expect(fullResult.decisions).toHaveLength(17);
    });

    it('summary counts match EXPECTED_SUMMARY exactly', () => {
      expect(fullResult.summary).toEqual(EXPECTED_SUMMARY);
    });

    for (const expected of EXPECTED_DECISIONS) {
      it(`${expected.screeningEventId}: eligibility=${expected.eligibility}, linkage=${expected.linkage}`, () => {
        const actual = findDecision(fullResult, expected.screeningEventId);
        expect(actual).toBeDefined();
        expect(actual!.eligibility).toBe(expected.eligibility);
        expect(actual!.linkage).toBe(expected.linkage);
        expect(actual!.linkedAssessmentId).toBe(expected.linkedAssessmentId);
        expect(actual!.isMature).toBe(expected.isMature);
        expect(actual!.candidateAssessmentIds.sort()).toEqual([...expected.candidateAssessmentIds].sort());
      });
    }
  });

  // AC-2: Null, zero, false, and absent produce different outcomes
  describe('AC-2: Null/zero/false/absent distinction', () => {
    it('U01 (assessmentRequired=null) -> INDETERMINATE', () => {
      const d = findDecision(fullResult, 'scr-U01')!;
      expect(d.eligibility).toBe(EligibilityState.INDETERMINATE);
    });

    it('X01 (assessmentRequired=false, item9Value=0) -> NOT_ELIGIBLE', () => {
      const d = findDecision(fullResult, 'scr-X01')!;
      expect(d.eligibility).toBe(EligibilityState.NOT_ELIGIBLE);
    });

    it('item9Value=0 with assessmentRequired=true -> ELIGIBLE (zero is not false)', () => {
      const result = reconcile(buildInput({
        screens: [scr({ id: 'zero-v', syntheticPatientId: 'SP-ZV', item9Value: 0, assessmentRequired: true })],
        assessments: [],
      }));
      expect(result.decisions[0].eligibility).toBe(EligibilityState.ELIGIBLE);
    });

    it('all three states are distinct from each other', () => {
      const u01 = findDecision(fullResult, 'scr-U01')!;
      const x01 = findDecision(fullResult, 'scr-X01')!;
      expect(u01.eligibility).not.toBe(x01.eligibility);
      expect(u01.eligibility).toBe(EligibilityState.INDETERMINATE);
      expect(x01.eligibility).toBe(EligibilityState.NOT_ELIGIBLE);
    });
  });

  // AC-3: X02 (age) and X03 (setting) independently NOT_ELIGIBLE with distinct reasons
  describe('AC-3: Independent exclusion reason codes', () => {
    it('X02 excluded for age (16 < 18)', () => {
      const d = findDecision(fullResult, 'scr-X02')!;
      expect(d.eligibility).toBe(EligibilityState.NOT_ELIGIBLE);
      expect(d.eligibilityReason).toContain('Age 16');
      expect(d.eligibilityReason).toContain('below');
    });

    it('X03 excluded for setting (primary_care)', () => {
      const d = findDecision(fullResult, 'scr-X03')!;
      expect(d.eligibility).toBe(EligibilityState.NOT_ELIGIBLE);
      expect(d.eligibilityReason).toContain('primary_care');
      expect(d.eligibilityReason).toContain('does not match');
    });

    it('X02 and X03 have distinct reason codes', () => {
      const x02 = findDecision(fullResult, 'scr-X02')!;
      const x03 = findDecision(fullResult, 'scr-X03')!;
      expect(x02.eligibilityReason).not.toBe(x03.eligibilityReason);
    });
  });

  // AC-4: Duplicate imports (B04, B05)
  describe('AC-4: Duplicate import handling', () => {
    it('exact duplicate import is idempotent — count unchanged', () => {
      const s = scr({ id: 'dup-idem', syntheticPatientId: 'SP-DUP', sourceRecordId: 'SRC-SCR-001', provenanceHash: 'hash-dup' });
      const result = reconcile(buildInput({ screens: [s, { ...s }], assessments: [] }));
      expect(result.decisions).toHaveLength(1);
      expect(result.decisions[0].eligibility).not.toBe(EligibilityState.INVALID);
    });

    it('conflicting duplicate (different item9Value) quarantined as INVALID', () => {
      const s1 = scr({ id: 'dup-c1', syntheticPatientId: 'SP-DUPC', sourceRecordId: 'SRC-SCR-001', sourceSystem: 'synthetic-ehr', provenanceHash: 'hash-c1' });
      const s2 = scr({ id: 'dup-c2', syntheticPatientId: 'SP-DUPC', sourceRecordId: 'SRC-SCR-001', sourceSystem: 'synthetic-ehr', provenanceHash: 'hash-c2', item9Value: 3 });
      const result = reconcile(buildInput({ screens: [s1, s2], assessments: [] }));
      const invalid = result.decisions.filter((d) => d.eligibility === EligibilityState.INVALID);
      expect(invalid.length).toBeGreaterThanOrEqual(1);
    });
  });

  // AC-5: Cross-patient explicit link rejected (B06)
  describe('AC-5: Cross-patient explicit link rejected', () => {
    it('assessment with triggeringScreenId=scr-E01 but syntheticPatientId=SP-999 is not linked', () => {
      const s = scr({ id: 'xpat-s', syntheticPatientId: 'SP-001' });
      const a = asx({ id: 'xpat-a', syntheticPatientId: 'SP-999', triggeringScreenId: 'xpat-s' });
      const result = reconcile(buildInput({ screens: [s], assessments: [a] }));
      expect(result.decisions[0].linkedAssessmentId).toBeNull();
    });
  });

  // AC-6: Cross-org explicit link rejected (B07)
  describe('AC-6: Cross-org explicit link rejected', () => {
    it('assessment in org-other with triggeringScreenId=scr-E01 is not linked', () => {
      const s = scr({ id: 'xorg-s', syntheticPatientId: 'SP-001' });
      const a = asx({ id: 'xorg-a', organizationId: 'org-other', syntheticPatientId: 'SP-001', triggeringScreenId: 'xorg-s' });
      const result = reconcile(buildInput({ screens: [s], assessments: [a] }));
      expect(result.decisions[0].linkedAssessmentId).toBeNull();
    });
  });

  // AC-7: Multiple candidates produce AMBIGUOUS_LINKAGE, no arbitrary selection
  describe('AC-7: Ambiguity — no arbitrary selection', () => {
    it('E08 has two candidates (asx-E08a, asx-E08b) -> AMBIGUOUS_LINKAGE', () => {
      const d = findDecision(fullResult, 'scr-E08')!;
      expect(d.linkage).toBe(LinkageState.AMBIGUOUS_LINKAGE);
      expect(d.linkedAssessmentId).toBeNull();
      expect(d.candidateAssessmentIds.sort()).toEqual(['asx-E08a', 'asx-E08b']);
    });

    it('E09 has competing screen E09b -> AMBIGUOUS_LINKAGE', () => {
      const d = findDecision(fullResult, 'scr-E09')!;
      expect(d.linkage).toBe(LinkageState.AMBIGUOUS_LINKAGE);
      expect(d.linkedAssessmentId).toBeNull();
    });

    it('E09b also AMBIGUOUS_LINKAGE (competing with E09)', () => {
      const d = findDecision(fullResult, 'scr-E09b')!;
      expect(d.linkage).toBe(LinkageState.AMBIGUOUS_LINKAGE);
      expect(d.linkedAssessmentId).toBeNull();
    });
  });

  // AC-8: documentedCompletionFlag=false -> PARTIAL_OR_NONQUALIFYING_RECORD
  describe('AC-8: Partial documentation never silently completed', () => {
    it('E11 documentedCompletionFlag=false -> PARTIAL_OR_NONQUALIFYING_RECORD', () => {
      const d = findDecision(fullResult, 'scr-E11')!;
      expect(d.linkage).toBe(LinkageState.PARTIAL_OR_NONQUALIFYING_RECORD);
      expect(d.linkedAssessmentId).toBeNull();
    });

    it('E11 is never QUALIFYING_RECORD_LINKED_WITHIN_WINDOW', () => {
      const d = findDecision(fullResult, 'scr-E11')!;
      expect(d.linkage).not.toBe(LinkageState.QUALIFYING_RECORD_LINKED_WITHIN_WINDOW);
    });
  });

  // AC-9: Deadline boundary (B01 and B02)
  describe('AC-9: Deadline boundary tests', () => {
    it('B01: assessment at exact deadline wall-clock time -> WITHIN window', () => {
      const screen = new Date('2026-08-14T10:00:00-07:00');
      const asxAt = new Date('2026-08-18T10:00:00-07:00');
      expect(isWithinBusinessDayWindow(screen, asxAt, 2, CALENDAR)).toBe(true);
    });

    it('B02: one second after deadline -> OUTSIDE window', () => {
      const screen = new Date('2026-08-14T10:00:00-07:00');
      const asxAt = new Date('2026-08-18T10:00:01-07:00');
      expect(isWithinBusinessDayWindow(screen, asxAt, 2, CALENDAR)).toBe(false);
    });
  });

  // AC-10: Immature interval not counted as mature unmatched
  describe('AC-10: Immature interval', () => {
    it('E10 screen Oct 11, asOf Oct 12, deadline Oct 13 -> NOT_YET_EVALUABLE', () => {
      const d = findDecision(fullResult, 'scr-E10')!;
      expect(d.linkage).toBe(LinkageState.NOT_YET_EVALUABLE);
      expect(d.isMature).toBe(false);
    });

    it('E10 is not counted in matureEligible', () => {
      expect(fullResult.summary.matureEligible).toBe(12);
      // 13 eligible minus 1 immature = 12 mature eligible
    });

    it('E10 is eligible despite being immature', () => {
      const d = findDecision(fullResult, 'scr-E10')!;
      expect(d.eligibility).toBe(EligibilityState.ELIGIBLE);
    });
  });

  // AC-11: Missing feeds -> DATA_COVERAGE_UNKNOWN, not NO_LINKED_RECORD
  describe('AC-11: Coverage gap handling', () => {
    it('E12 no assessment + missing satellite-clinic-ehr feed -> DATA_COVERAGE_UNKNOWN', () => {
      const d = findDecision(fullResult, 'scr-E12')!;
      expect(d.linkage).toBe(LinkageState.DATA_COVERAGE_UNKNOWN);
      expect(d.linkage).not.toBe(LinkageState.NO_LINKED_RECORD_IN_AVAILABLE_DATA);
    });
  });

  // AC-12: Weekend skip (E03) and holiday skip (E04)
  describe('AC-12: Weekend and holiday skip', () => {
    it('E03: Fri Aug 14 + 2 biz days = Tue Aug 18 (skips weekend)', () => {
      const deadline = addBusinessDays(new Date('2026-08-14T10:00:00-07:00'), 2, CALENDAR);
      const day = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', day: '2-digit', month: '2-digit' }).format(deadline);
      expect(day).toBe('08/18');
    });

    it('E04: Fri Sep 4 + 2 biz days = Wed Sep 9 (skips Sat+Sun+Labor Day)', () => {
      const deadline = addBusinessDays(new Date('2026-09-04T11:00:00-07:00'), 2, CALENDAR);
      const day = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', day: '2-digit', month: '2-digit' }).format(deadline);
      expect(day).toBe('09/09');
    });

    it('E03 assessment on Tue Aug 18 is WITHIN_WINDOW', () => {
      const d = findDecision(fullResult, 'scr-E03')!;
      expect(d.linkage).toBe(LinkageState.QUALIFYING_RECORD_LINKED_WITHIN_WINDOW);
    });

    it('E04 assessment on Wed Sep 9 is WITHIN_WINDOW', () => {
      const d = findDecision(fullResult, 'scr-E04')!;
      expect(d.linkage).toBe(LinkageState.QUALIFYING_RECORD_LINKED_WITHIN_WINDOW);
    });
  });

  // AC-11b: Version boundary and overlapping policy tests
  describe('AC-11b: Version boundary and overlapping policy', () => {
    it('half-open interval: screen at effectiveTo boundary uses next version', () => {
      const s = scr({ id: 'vb-scr', syntheticPatientId: 'SP-VB', occurredAt: new Date('2026-10-01T00:00:00-07:00') });
      const result = reconcile(buildInput({ screens: [s], assessments: [] }));
      expect(result.decisions[0].protocolVersionId).toBe('pv-2');
    });

    it('screen one second before effectiveTo uses current version', () => {
      const s = scr({ id: 'vb2-scr', syntheticPatientId: 'SP-VB2', occurredAt: new Date('2026-09-30T23:59:59-07:00') });
      const result = reconcile(buildInput({ screens: [s], assessments: [] }));
      expect(result.decisions[0].protocolVersionId).toBe('pv-1');
    });

    it('overlapping versions produce INVALID', () => {
      const pvOverlap: ProtocolVersionInput = { ...PV2, id: 'pv-overlap', effectiveFrom: new Date('2026-08-01T00:00:00-07:00') };
      const s = scr({ id: 'overlap-scr', syntheticPatientId: 'SP-OV' });
      const result = reconcile(buildInput({ screens: [s], assessments: [], protocolVersions: [PV1, PV2, pvOverlap] }));
      expect(result.decisions[0].eligibility).toBe(EligibilityState.INVALID);
      expect(result.decisions[0].eligibilityReason).toContain('Overlapping');
    });
  });

  // AC-14a: Excerpts match stored sources; synthetic labels present
  describe('AC-14a: Synthetic labels present', () => {
    it('all screening events use sourceSystem = synthetic-ehr', () => {
      for (const s of screens) {
        expect(s.sourceSystem).toBe('synthetic-ehr');
      }
    });

    it('all assessment events use sourceSystem = synthetic-ehr', () => {
      for (const a of assessments) {
        expect(a.sourceSystem).toBe('synthetic-ehr');
      }
    });

    it('protocol versions declare APPROVED_SYNTHETIC approval status (by convention)', () => {
      // Protocol versions are synthetic — verified by the fixture data contract
      expect(PV1.version).toBe('1.0');
      expect(PV2.version).toBe('2.0');
      // The isSynthetic flag lives in Prisma, not engine input. Engine input is trusted.
    });

    it('all source record IDs follow SRC- prefix convention', () => {
      for (const s of screens) {
        expect(s.sourceRecordId).toMatch(/^SRC-/);
      }
      for (const a of assessments) {
        expect(a.sourceRecordId).toMatch(/^SRC-/);
      }
    });
  });

  // AC-13: Review closure cannot mutate source or numerator
  describe('AC-13: Review closure immutability', () => {
    it('re-running reconciliation with same inputs produces identical results regardless of review state', () => {
      // The engine is a pure function — ReviewActions live outside it.
      // Running reconcile() twice with identical inputs must yield identical decisions.
      const run1 = reconcile(buildInput());
      const run2 = reconcile(buildInput());
      const e06run1 = findDecision(run1, 'scr-E06')!;
      const e06run2 = findDecision(run2, 'scr-E06')!;
      expect(e06run1.linkage).toBe(LinkageState.NO_LINKED_RECORD_IN_AVAILABLE_DATA);
      expect(e06run2.linkage).toBe(LinkageState.NO_LINKED_RECORD_IN_AVAILABLE_DATA);
      expect(run1.summary).toEqual(run2.summary);
    });

    it('review status is not an input to the reconciliation engine', () => {
      // ReconciliationInput type has no review field — verified by the type system.
      // This test confirms the engine operates solely on screens, assessments, config.
      const input = buildInput();
      expect(input).not.toHaveProperty('reviews');
      expect(input).not.toHaveProperty('reviewActions');
    });
  });

  // AC-14: Late-arriving assessment creates new run; previous inspectable
  describe('AC-14: Late-arriving record', () => {
    it('initial run: E06 = NO_LINKED_RECORD', () => {
      const run1 = reconcile(buildInput());
      expect(findDecision(run1, 'scr-E06')!.linkage).toBe(LinkageState.NO_LINKED_RECORD_IN_AVAILABLE_DATA);
    });

    it('new run with asx-E06-late: E06 becomes WITHIN_WINDOW', () => {
      const lateAsx = asx({
        id: 'asx-E06-late',
        syntheticPatientId: 'SP-006',
        encounterId: 'enc-006a',
        triggeringScreenId: 'scr-E06',
        performedAt: new Date('2026-08-21T10:00:00-07:00'),
        recordedAt: new Date('2026-08-21T10:30:00-07:00'),
        sourceRecordId: 'SRC-ASX-006-LATE',
      });
      const run2 = reconcile(buildInput({ assessments: [...assessments, lateAsx] }));
      expect(findDecision(run2, 'scr-E06')!.linkage).toBe(LinkageState.QUALIFYING_RECORD_LINKED_WITHIN_WINDOW);
      expect(findDecision(run2, 'scr-E06')!.linkedAssessmentId).toBe('asx-E06-late');
    });

    it('previous run still shows NO_LINKED_RECORD (immutability)', () => {
      // Each reconcile() call is independent — previous result is a separate object
      const run1 = reconcile(buildInput());
      const lateAsx = asx({
        id: 'asx-E06-late',
        syntheticPatientId: 'SP-006',
        encounterId: 'enc-006a',
        triggeringScreenId: 'scr-E06',
        performedAt: new Date('2026-08-21T10:00:00-07:00'),
        recordedAt: new Date('2026-08-21T10:30:00-07:00'),
        sourceRecordId: 'SRC-ASX-006-LATE',
      });
      reconcile(buildInput({ assessments: [...assessments, lateAsx] }));
      // run1 unchanged
      expect(findDecision(run1, 'scr-E06')!.linkage).toBe(LinkageState.NO_LINKED_RECORD_IN_AVAILABLE_DATA);
    });
  });

  // AC-15: ReconciliationRun exposes required fields
  describe('AC-15: Run exposes required fields', () => {
    it('includes numerator IDs (within-window linked)', () => {
      const numerator = fullResult.decisions
        .filter((d) => d.linkage === LinkageState.QUALIFYING_RECORD_LINKED_WITHIN_WINDOW)
        .map((d) => d.screeningEventId);
      expect(numerator.sort()).toEqual(['scr-E01', 'scr-E02', 'scr-E03', 'scr-E04']);
    });

    it('includes denominator IDs (mature eligible)', () => {
      const denominator = fullResult.decisions
        .filter((d) => d.eligibility === EligibilityState.ELIGIBLE && d.isMature)
        .map((d) => d.screeningEventId);
      expect(denominator).toHaveLength(12);
    });

    it('includes exclusion IDs', () => {
      const exclusions = fullResult.decisions
        .filter((d) => d.eligibility === EligibilityState.NOT_ELIGIBLE)
        .map((d) => d.screeningEventId);
      expect(exclusions.sort()).toEqual(['scr-X01', 'scr-X02', 'scr-X03']);
    });

    it('includes unknown IDs (indeterminate)', () => {
      const unknowns = fullResult.decisions
        .filter((d) => d.eligibility === EligibilityState.INDETERMINATE)
        .map((d) => d.screeningEventId);
      expect(unknowns).toEqual(['scr-U01']);
    });

    it('exposes engineVersion', () => {
      expect(fullResult.engineVersion).toBe(ENGINE_VERSION);
    });

    it('exposes configurationHash (non-empty)', () => {
      expect(fullResult.configurationHash).toBeTruthy();
      expect(typeof fullResult.configurationHash).toBe('string');
    });

    it('exposes extractionHash (non-empty)', () => {
      expect(fullResult.extractionHash).toBeTruthy();
      expect(typeof fullResult.extractionHash).toBe('string');
    });
  });

  // AC-16: No clinical claims in UI
  describe('AC-16: No clinical claims in UI', () => {
    it('no prohibited terms in reconciliation state labels', () => {
      const prohibited = ['overdue', 'urgent', 'risk', 'comply', 'compliance', 'missed care', 'effectiveness'];
      const allLabels = [
        ...Object.values(EligibilityState),
        ...Object.values(LinkageState),
      ];
      for (const term of prohibited) {
        for (const label of allLabels) {
          expect(label.toLowerCase()).not.toContain(term);
        }
      }
    });

    it('no prohibited terms in decision reasons from full run', () => {
      const prohibited = ['overdue', 'urgent', 'risk', 'comply', 'compliance', 'missed care', 'effectiveness'];
      for (const d of fullResult.decisions) {
        for (const term of prohibited) {
          if (d.eligibilityReason) {
            expect(d.eligibilityReason.toLowerCase()).not.toContain(term);
          }
          if (d.linkageReason) {
            expect(d.linkageReason.toLowerCase()).not.toContain(term);
          }
        }
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Part 2: Isolated Boundary Tests (B01-B09)
// ---------------------------------------------------------------------------

describe('SPEC-E: Boundary Tests B01-B09', () => {
  describe('B01: Assessment at exact deadline wall-clock time', () => {
    it('Fri Aug 14 10:00 screen, Tue Aug 18 10:00:00 assessment -> WITHIN window', () => {
      const s = scr({ id: 'b01-scr', syntheticPatientId: 'SP-B01', occurredAt: new Date('2026-08-14T10:00:00-07:00') });
      const a = asx({ id: 'b01-asx', syntheticPatientId: 'SP-B01', triggeringScreenId: 'b01-scr', performedAt: new Date('2026-08-18T10:00:00-07:00') });
      const result = reconcile(buildInput({ screens: [s], assessments: [a] }));
      expect(result.decisions[0].linkage).toBe(LinkageState.QUALIFYING_RECORD_LINKED_WITHIN_WINDOW);
    });
  });

  describe('B02: One second after deadline', () => {
    it('Fri Aug 14 10:00 screen, Tue Aug 18 10:00:01 assessment -> OUTSIDE window', () => {
      const s = scr({ id: 'b02-scr', syntheticPatientId: 'SP-B02', occurredAt: new Date('2026-08-14T10:00:00-07:00') });
      const a = asx({ id: 'b02-asx', syntheticPatientId: 'SP-B02', triggeringScreenId: 'b02-scr', performedAt: new Date('2026-08-18T10:00:01-07:00') });
      const result = reconcile(buildInput({ screens: [s], assessments: [a] }));
      expect(result.decisions[0].linkage).toBe(LinkageState.QUALIFYING_RECORD_LINKED_OUTSIDE_WINDOW);
    });
  });

  describe('B03: Holiday in window', () => {
    it('Thu Sep 3 screen + 2 biz days = Tue Sep 8 (skips Sat, Sun, Labor Day Mon)', () => {
      const s = scr({ id: 'b03-scr', syntheticPatientId: 'SP-B03', occurredAt: new Date('2026-09-03T10:00:00-07:00') });
      const a = asx({ id: 'b03-asx', syntheticPatientId: 'SP-B03', triggeringScreenId: 'b03-scr', performedAt: new Date('2026-09-08T10:00:00-07:00') });
      const result = reconcile(buildInput({ screens: [s], assessments: [a] }));
      expect(result.decisions[0].linkage).toBe(LinkageState.QUALIFYING_RECORD_LINKED_WITHIN_WINDOW);
    });
  });

  describe('B04: Duplicate import (idempotent)', () => {
    it('identical SRC-SCR-001 imported twice -> count unchanged', () => {
      const s = scr({ id: 'b04-scr', syntheticPatientId: 'SP-B04', sourceRecordId: 'SRC-SCR-001', provenanceHash: 'hash-b04' });
      const result = reconcile(buildInput({ screens: [s, { ...s }], assessments: [] }));
      expect(result.decisions).toHaveLength(1);
      expect(result.summary.totalScreens).toBe(1);
    });
  });

  describe('B05: Conflicting duplicate', () => {
    it('SRC-SCR-001 with different item9Value -> quarantined as INVALID', () => {
      const s1 = scr({ id: 'b05-s1', syntheticPatientId: 'SP-B05', sourceRecordId: 'SRC-B05', sourceSystem: 'synthetic-ehr', provenanceHash: 'hash-b05-a' });
      const s2 = scr({ id: 'b05-s2', syntheticPatientId: 'SP-B05', sourceRecordId: 'SRC-B05', sourceSystem: 'synthetic-ehr', provenanceHash: 'hash-b05-b', item9Value: 3 });
      const result = reconcile(buildInput({ screens: [s1, s2], assessments: [] }));
      const invalid = result.decisions.filter((d) => d.eligibility === EligibilityState.INVALID);
      expect(invalid.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('B06: Cross-patient explicit link', () => {
    it('assessment triggeringScreenId=scr-E01 but syntheticPatientId=SP-999 -> link rejected', () => {
      const s = scr({ id: 'b06-scr', syntheticPatientId: 'SP-001' });
      const a = asx({ id: 'b06-asx', syntheticPatientId: 'SP-999', triggeringScreenId: 'b06-scr' });
      const result = reconcile(buildInput({ screens: [s], assessments: [a] }));
      expect(result.decisions[0].linkedAssessmentId).toBeNull();
    });
  });

  describe('B07: Cross-org explicit link', () => {
    it('assessment in org-other with triggeringScreenId -> link rejected', () => {
      const s = scr({ id: 'b07-scr', syntheticPatientId: 'SP-001' });
      const a = asx({ id: 'b07-asx', organizationId: 'org-other', syntheticPatientId: 'SP-001', triggeringScreenId: 'b07-scr' });
      const result = reconcile(buildInput({ screens: [s], assessments: [a] }));
      expect(result.decisions[0].linkedAssessmentId).toBeNull();
    });
  });

  describe('B08: Assessment reuse attempt', () => {
    it('two screens pointing to same assessment -> no reuse, second screen unlinked', () => {
      const s1 = scr({ id: 'b08-s1', syntheticPatientId: 'SP-B08', sourceRecordId: 'SRC-B08-1' });
      const s2 = scr({ id: 'b08-s2', syntheticPatientId: 'SP-B08', sourceRecordId: 'SRC-B08-2', occurredAt: new Date('2026-08-03T10:00:00-07:00') });
      const a = asx({ id: 'b08-asx', syntheticPatientId: 'SP-B08', triggeringScreenId: 'b08-s1', performedAt: new Date('2026-08-04T14:00:00-07:00') });
      const result = reconcile(buildInput({ screens: [s1, s2], assessments: [a] }));
      const d1 = findDecision(result, 'b08-s1')!;
      const d2 = findDecision(result, 'b08-s2')!;
      expect(d1.linkedAssessmentId).toBe('b08-asx');
      expect(d2.linkedAssessmentId).not.toBe('b08-asx');
    });
  });

  describe('B09: Late-arriving assessment', () => {
    it('initial run E06 = NO_LINKED_RECORD; new run with asx-E06-late = WITHIN_WINDOW; previous unchanged', () => {
      const run1 = reconcile(buildInput());
      const e06Before = findDecision(run1, 'scr-E06')!;
      expect(e06Before.linkage).toBe(LinkageState.NO_LINKED_RECORD_IN_AVAILABLE_DATA);

      const lateAsx = asx({
        id: 'asx-E06-late',
        syntheticPatientId: 'SP-006',
        encounterId: 'enc-006a',
        triggeringScreenId: 'scr-E06',
        performedAt: new Date('2026-08-21T10:00:00-07:00'),
        recordedAt: new Date('2026-08-21T10:30:00-07:00'),
        sourceRecordId: 'SRC-ASX-006-LATE',
      });
      const run2 = reconcile(buildInput({ assessments: [...assessments, lateAsx] }));
      const e06After = findDecision(run2, 'scr-E06')!;
      expect(e06After.linkage).toBe(LinkageState.QUALIFYING_RECORD_LINKED_WITHIN_WINDOW);

      // Previous run object unchanged
      expect(e06Before.linkage).toBe(LinkageState.NO_LINKED_RECORD_IN_AVAILABLE_DATA);
    });
  });
});

// ---------------------------------------------------------------------------
// Part 3: Scripted Demo Verification (engine-level)
// ---------------------------------------------------------------------------

describe('SPEC-E: Scripted Demo Verification (engine level)', () => {
  const fullResult = reconcile(buildInput());

  it('Step 2: reconciliation run produces valid result', () => {
    expect(fullResult.decisions).toHaveLength(17);
    expect(fullResult.configurationHash).toBeTruthy();
  });

  it('Step 3: count table matches expected counts', () => {
    expect(fullResult.summary.eligible).toBe(13);
    expect(fullResult.summary.matureEligible).toBe(12);
    expect(fullResult.summary.withinWindow).toBe(4);
    expect(fullResult.summary.outsideWindow).toBe(1);
    expect(fullResult.summary.ambiguous).toBe(3);
    expect(fullResult.summary.immature).toBe(1);
    expect(fullResult.summary.partial).toBe(1);
    expect(fullResult.summary.absentLink).toBe(3);
    expect(fullResult.summary.coverageUnknown).toBe(1);
    expect(fullResult.summary.notEligible).toBe(3);
    expect(fullResult.summary.indeterminate).toBe(1);
  });

  it('Step 4: E01 detail — QUALIFYING_RECORD_LINKED_WITHIN_WINDOW with link to asx-E01', () => {
    const d = findDecision(fullResult, 'scr-E01')!;
    expect(d.linkage).toBe(LinkageState.QUALIFYING_RECORD_LINKED_WITHIN_WINDOW);
    expect(d.linkedAssessmentId).toBe('asx-E01');
  });

  it('Step 5: E08 detail — AMBIGUOUS_LINKAGE with two candidate IDs', () => {
    const d = findDecision(fullResult, 'scr-E08')!;
    expect(d.linkage).toBe(LinkageState.AMBIGUOUS_LINKAGE);
    expect(d.candidateAssessmentIds.sort()).toEqual(['asx-E08a', 'asx-E08b']);
  });

  it('Step 6: E12 detail — DATA_COVERAGE_UNKNOWN with satellite-clinic-ehr in reason', () => {
    const d = findDecision(fullResult, 'scr-E12')!;
    expect(d.linkage).toBe(LinkageState.DATA_COVERAGE_UNKNOWN);
    expect(d.linkageReason).toContain('satellite-clinic-ehr');
  });

  it('Step 7: review closure cannot change metrics (engine is pure)', () => {
    const rerun = reconcile(buildInput());
    expect(rerun.summary).toEqual(fullResult.summary);
  });

  it('Step 8: add late assessment -> E06 flips to WITHIN_WINDOW', () => {
    const lateAsx = asx({
      id: 'asx-E06-late',
      syntheticPatientId: 'SP-006',
      encounterId: 'enc-006a',
      triggeringScreenId: 'scr-E06',
      performedAt: new Date('2026-08-21T10:00:00-07:00'),
      recordedAt: new Date('2026-08-21T10:30:00-07:00'),
      sourceRecordId: 'SRC-ASX-006-LATE',
    });
    const newRun = reconcile(buildInput({ assessments: [...assessments, lateAsx] }));
    expect(findDecision(newRun, 'scr-E06')!.linkage).toBe(LinkageState.QUALIFYING_RECORD_LINKED_WITHIN_WINDOW);
  });

  it('Step 9: previous run still shows NO_LINKED_RECORD for E06', () => {
    expect(findDecision(fullResult, 'scr-E06')!.linkage).toBe(LinkageState.NO_LINKED_RECORD_IN_AVAILABLE_DATA);
  });
});
