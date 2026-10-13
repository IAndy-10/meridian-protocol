/**
 * Known-answer tests for the deterministic reconciliation engine.
 * Fixtures from specs/FIXTURES.md. All times are America/Los_Angeles.
 *
 * SYNTHETIC — NOT AN APPROVED CLINICAL PROCEDURE.
 */
import { EligibilityState, LinkageState, EXPECTED_DECISIONS, EXPECTED_SUMMARY, verifyExpectedCounts } from '@app-starter/shared';
import { reconcile } from './reconcile';
import { addBusinessDays, isWithinBusinessDayWindow } from './business-day-calendar';
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
// Concrete fixtures from specs/FIXTURES.md
// ---------------------------------------------------------------------------

const ORG_ID = 'org-aegis-001';
const ENGINE_VERSION = '0.1.0';

const CALENDAR: BusinessDayCalendar = {
  timezone: 'America/Los_Angeles',
  holidays: ['2026-09-07', '2026-11-26'], // Labor Day, Thanksgiving
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

// Screening events per FIXTURES.md
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

// Assessment events per FIXTURES.md
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Reconciliation Engine', () => {
  describe('Expected fixture counts verification', () => {
    it('verifies hand-labeled expected counts are internally consistent', () => {
      expect(() => verifyExpectedCounts()).not.toThrow();
    });
  });

  describe('Full fixture run (E01-E12, E09b, X01-X03, U01)', () => {
    const result = reconcile(buildInput());

    it('produces correct number of decisions', () => {
      expect(result.decisions).toHaveLength(EXPECTED_SUMMARY.totalScreens);
    });

    it('produces correct summary counts', () => {
      expect(result.summary).toEqual(EXPECTED_SUMMARY);
    });

    for (const expected of EXPECTED_DECISIONS) {
      it(`${expected.screeningEventId}: correct eligibility and linkage`, () => {
        const actual = result.decisions.find((d) => d.screeningEventId === expected.screeningEventId);
        expect(actual).toBeDefined();
        expect(actual!.eligibility).toBe(expected.eligibility);
        expect(actual!.linkage).toBe(expected.linkage);
        expect(actual!.linkedAssessmentId).toBe(expected.linkedAssessmentId);
        expect(actual!.isMature).toBe(expected.isMature);
        expect(actual!.candidateAssessmentIds.sort()).toEqual([...expected.candidateAssessmentIds].sort());
      });
    }

    it('includes configuration and extraction hashes', () => {
      expect(result.configurationHash).toBeTruthy();
      expect(result.extractionHash).toBeTruthy();
      expect(result.engineVersion).toBe(ENGINE_VERSION);
    });
  });

  describe('Business-day calendar', () => {
    it('E01: Mon Aug 3 + 2 biz days = Wed Aug 5', () => {
      const anchor = new Date('2026-08-03T09:30:00-07:00');
      const deadline = addBusinessDays(anchor, 2, CALENDAR);
      // Should be Wed Aug 5 at 09:30 PT
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', day: '2-digit', month: '2-digit' }).format(deadline);
      expect(parts).toBe('08/05');
    });

    it('E03: Fri Aug 14 + 2 biz days = Tue Aug 18 (skips weekend)', () => {
      const anchor = new Date('2026-08-14T10:00:00-07:00');
      const deadline = addBusinessDays(anchor, 2, CALENDAR);
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', day: '2-digit', month: '2-digit' }).format(deadline);
      expect(parts).toBe('08/18');
    });

    it('E04: Fri Sep 4 + 2 biz days = Wed Sep 9 (skips Sat+Sun+Labor Day)', () => {
      const anchor = new Date('2026-09-04T11:00:00-07:00');
      const deadline = addBusinessDays(anchor, 2, CALENDAR);
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', day: '2-digit', month: '2-digit' }).format(deadline);
      expect(parts).toBe('09/09');
    });

    it('E10: Sun Oct 11 + 2 biz days = Tue Oct 13', () => {
      const anchor = new Date('2026-10-11T14:00:00-07:00');
      const deadline = addBusinessDays(anchor, 2, CALENDAR);
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', day: '2-digit', month: '2-digit' }).format(deadline);
      expect(parts).toBe('10/13');
    });

    it('preserves wall-clock time after advancing', () => {
      const anchor = new Date('2026-08-03T09:30:00-07:00');
      const deadline = addBusinessDays(anchor, 2, CALENDAR);
      const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', hour12: false }).format(deadline);
      expect(fmt).toBe('09:30');
    });

    it('inclusive endpoint: assessment at exact deadline time is within window', () => {
      // E03: Fri Aug 14 10:00 + 2 biz = Tue Aug 18 10:00
      const screen = new Date('2026-08-14T10:00:00-07:00');
      const asxAt = new Date('2026-08-18T09:00:00-07:00'); // Before deadline
      expect(isWithinBusinessDayWindow(screen, asxAt, 2, CALENDAR)).toBe(true);
    });

    it('B01: exactly at deadline = within window', () => {
      const screen = new Date('2026-08-14T10:00:00-07:00');
      const asxAt = new Date('2026-08-18T10:00:00-07:00');
      expect(isWithinBusinessDayWindow(screen, asxAt, 2, CALENDAR)).toBe(true);
    });

    it('B02: one second after deadline = outside window', () => {
      const screen = new Date('2026-08-14T10:00:00-07:00');
      const asxAt = new Date('2026-08-18T10:00:01-07:00');
      expect(isWithinBusinessDayWindow(screen, asxAt, 2, CALENDAR)).toBe(false);
    });

    it('B03: holiday in window', () => {
      // Thu Sep 3 + 2 biz = skip Fri(1), skip Sat, Sun, Mon Labor Day = Tue Sep 8(2)
      // Actually: Thu Sep 3 + 1 = Fri Sep 4, + 2 = Mon Sep 7 is holiday, Tue Sep 8
      const screen = new Date('2026-09-03T10:00:00-07:00');
      const asxAt = new Date('2026-09-08T10:00:00-07:00');
      expect(isWithinBusinessDayWindow(screen, asxAt, 2, CALENDAR)).toBe(true);
    });

    it('rejects assessment before screen', () => {
      const screen = new Date('2026-08-10T14:00:00-07:00');
      const before = new Date('2026-08-10T13:00:00-07:00');
      expect(isWithinBusinessDayWindow(screen, before, 2, CALENDAR)).toBe(false);
    });
  });

  describe('Null/zero/false/absent distinction', () => {
    it('null assessmentRequired -> INDETERMINATE', () => {
      const result = reconcile(buildInput({
        screens: [scr({ id: 'null-test', assessmentRequired: null, syntheticPatientId: 'SP-NULL' })],
        assessments: [],
      }));
      expect(result.decisions[0].eligibility).toBe(EligibilityState.INDETERMINATE);
    });

    it('false assessmentRequired -> NOT_ELIGIBLE', () => {
      const result = reconcile(buildInput({
        screens: [scr({ id: 'false-test', assessmentRequired: false, syntheticPatientId: 'SP-FALSE' })],
        assessments: [],
      }));
      expect(result.decisions[0].eligibility).toBe(EligibilityState.NOT_ELIGIBLE);
    });

    it('item9Value = 0 with assessmentRequired = true -> ELIGIBLE', () => {
      const result = reconcile(buildInput({
        screens: [scr({ id: 'zero-test', item9Value: 0, assessmentRequired: true, syntheticPatientId: 'SP-ZERO' })],
        assessments: [],
      }));
      expect(result.decisions[0].eligibility).toBe(EligibilityState.ELIGIBLE);
    });

    it('documentedCompletionFlag = null -> PARTIAL_OR_NONQUALIFYING', () => {
      const s = scr({ id: 'dcf-null', syntheticPatientId: 'SP-DCF' });
      const a = asx({ id: 'asx-dcf', syntheticPatientId: 'SP-DCF', triggeringScreenId: 'dcf-null', documentedCompletionFlag: null, documentationStatus: 'COMPLETED' });
      const result = reconcile(buildInput({ screens: [s], assessments: [a] }));
      expect(result.decisions[0].linkage).toBe(LinkageState.PARTIAL_OR_NONQUALIFYING_RECORD);
    });
  });

  describe('Adversarial: duplicates', () => {
    it('B04: exact duplicate import is idempotent', () => {
      const s1 = scr({ id: 'dup-a', syntheticPatientId: 'SP-DUP', sourceRecordId: 'SRC-SCR-001', provenanceHash: 'hash-dup' });
      const s2 = { ...s1 }; // identical
      const result = reconcile(buildInput({ screens: [s1, s2], assessments: [] }));
      expect(result.decisions).toHaveLength(1);
    });

    it('B05: conflicting duplicate is quarantined', () => {
      const s1 = scr({ id: 'conf-a', syntheticPatientId: 'SP-CONF', sourceRecordId: 'SRC-SCR-001', sourceSystem: 'synthetic-ehr', provenanceHash: 'hash-a' });
      const s2 = scr({ id: 'conf-b', syntheticPatientId: 'SP-CONF', sourceRecordId: 'SRC-SCR-001', sourceSystem: 'synthetic-ehr', provenanceHash: 'hash-b', item9Value: 3 });
      const result = reconcile(buildInput({ screens: [s1, s2], assessments: [] }));
      const invalid = result.decisions.filter((d) => d.eligibility === EligibilityState.INVALID);
      expect(invalid.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Adversarial: cross-patient/org links', () => {
    it('B06: cross-patient explicit link is rejected', () => {
      const s = scr({ id: 'xpat-scr', syntheticPatientId: 'SP-001' });
      const a = asx({ id: 'xpat-asx', syntheticPatientId: 'SP-999', triggeringScreenId: 'xpat-scr' });
      const result = reconcile(buildInput({ screens: [s], assessments: [a] }));
      expect(result.decisions[0].linkedAssessmentId).toBeNull();
    });

    it('B07: cross-org explicit link is rejected', () => {
      const s = scr({ id: 'xorg-scr', syntheticPatientId: 'SP-001' });
      const a = asx({ id: 'xorg-asx', organizationId: 'org-other', syntheticPatientId: 'SP-001', triggeringScreenId: 'xorg-scr' });
      const result = reconcile(buildInput({ screens: [s], assessments: [a] }));
      expect(result.decisions[0].linkedAssessmentId).toBeNull();
    });
  });

  describe('Adversarial: assessment reuse', () => {
    it('B08: two screens pointing to same assessment -> ambiguous', () => {
      const s1 = scr({ id: 'reuse-s1', syntheticPatientId: 'SP-REUSE', sourceRecordId: 'SRC-R1' });
      const s2 = scr({ id: 'reuse-s2', syntheticPatientId: 'SP-REUSE', sourceRecordId: 'SRC-R2', occurredAt: new Date('2026-08-03T10:00:00-07:00') });
      const a = asx({ id: 'reuse-asx', syntheticPatientId: 'SP-REUSE', triggeringScreenId: 'reuse-s1', performedAt: new Date('2026-08-04T14:00:00-07:00') });
      const result = reconcile(buildInput({ screens: [s1, s2], assessments: [a] }));
      const d1 = result.decisions.find((d) => d.screeningEventId === 'reuse-s1')!;
      const d2 = result.decisions.find((d) => d.screeningEventId === 'reuse-s2')!;
      // First screen gets the link, second cannot reuse it
      expect(d1.linkedAssessmentId).toBe('reuse-asx');
      expect(d2.linkedAssessmentId).not.toBe('reuse-asx');
    });
  });

  describe('Config version pinning', () => {
    it('half-open: screen at effectiveTo is excluded from v1', () => {
      const s = scr({ id: 'boundary-cfg', syntheticPatientId: 'SP-BND', occurredAt: new Date('2026-10-01T00:00:00-07:00') });
      const result = reconcile(buildInput({ screens: [s], assessments: [] }));
      // Should use pv-2, not pv-1
      expect(result.decisions[0].protocolVersionId).toBe('pv-2');
    });

    it('overlapping versions block evaluation', () => {
      const pvOverlap = { ...PV2, id: 'pv-overlap', effectiveFrom: new Date('2026-08-01T00:00:00-07:00') };
      const s = scr({ id: 'overlap-scr', syntheticPatientId: 'SP-OV' });
      const result = reconcile(buildInput({ screens: [s], assessments: [], protocolVersions: [PV1, PV2, pvOverlap] }));
      expect(result.decisions[0].eligibility).toBe(EligibilityState.INVALID);
      expect(result.decisions[0].eligibilityReason).toContain('Overlapping');
    });
  });

  describe('Deterministic guarantee', () => {
    it('same input produces identical output', () => {
      const input = buildInput();
      const r1 = reconcile(input);
      const r2 = reconcile(input);
      expect(r1.decisions).toEqual(r2.decisions);
      expect(r1.summary).toEqual(r2.summary);
      expect(r1.configurationHash).toBe(r2.configurationHash);
    });
  });

  describe('Late-arriving assessment (B09)', () => {
    it('new run with late assessment changes E06 from NO_LINKED to WITHIN_WINDOW', () => {
      const lateAsx = asx({
        id: 'asx-E06-late',
        syntheticPatientId: 'SP-006',
        encounterId: 'enc-006a',
        triggeringScreenId: 'scr-E06',
        performedAt: new Date('2026-08-21T10:00:00-07:00'),
        recordedAt: new Date('2026-08-21T10:30:00-07:00'),
        sourceRecordId: 'SRC-ASX-006-LATE',
      });
      const result = reconcile(buildInput({ assessments: [...assessments, lateAsx] }));
      const e06 = result.decisions.find((d) => d.screeningEventId === 'scr-E06')!;
      expect(e06.linkage).toBe(LinkageState.QUALIFYING_RECORD_LINKED_WITHIN_WINDOW);
      expect(e06.linkedAssessmentId).toBe('asx-E06-late');
    });
  });
});
