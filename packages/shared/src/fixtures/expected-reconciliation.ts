/**
 * Hand-labeled expected reconciliation outputs for the AegisBrain known-answer
 * dataset. Written BEFORE any engine code exists per PROBLEM.md Section 12.
 * Updated to match specs/FIXTURES.md concrete values including E09b competing screen.
 *
 * SYNTHETIC — NOT AN APPROVED CLINICAL PROCEDURE.
 * All data is fictional. No clinical claims.
 */
import {
  EligibilityState,
  LinkageState,
  ReconciliationDecision,
  ReconciliationSummary,
} from '../types/reconciliation';

export const EXPECTED_DECISIONS: ReadonlyArray<
  Pick<
    ReconciliationDecision,
    'screeningEventId' | 'eligibility' | 'eligibilityReason' | 'linkage' | 'linkageReason' | 'linkedAssessmentId' | 'candidateAssessmentIds' | 'isMature'
  >
> = [
  {
    screeningEventId: 'scr-E01',
    eligibility: EligibilityState.ELIGIBLE,
    eligibilityReason: 'PHQ-9 item 9 = 2, assessmentRequired = true, age 34, specialty_mental_health',
    linkage: LinkageState.QUALIFYING_RECORD_LINKED_WITHIN_WINDOW,
    linkageReason: 'Explicit triggeringScreenId link validated',
    linkedAssessmentId: 'asx-E01',
    candidateAssessmentIds: ['asx-E01'],
    isMature: true,
  },
  {
    screeningEventId: 'scr-E02',
    eligibility: EligibilityState.ELIGIBLE,
    eligibilityReason: 'PHQ-9 item 9 = 1, assessmentRequired = true, age 45, specialty_mental_health',
    linkage: LinkageState.QUALIFYING_RECORD_LINKED_WITHIN_WINDOW,
    linkageReason: 'Same-encounter fallback: exactly one candidate assessment with no explicit link in same encounter',
    linkedAssessmentId: 'asx-E02',
    candidateAssessmentIds: ['asx-E02'],
    isMature: true,
  },
  {
    screeningEventId: 'scr-E03',
    eligibility: EligibilityState.ELIGIBLE,
    eligibilityReason: 'PHQ-9 item 9 = 3, assessmentRequired = true, age 28, specialty_mental_health',
    linkage: LinkageState.QUALIFYING_RECORD_LINKED_WITHIN_WINDOW,
    linkageReason: 'Explicit triggeringScreenId link validated',
    linkedAssessmentId: 'asx-E03',
    candidateAssessmentIds: ['asx-E03'],
    isMature: true,
  },
  {
    screeningEventId: 'scr-E04',
    eligibility: EligibilityState.ELIGIBLE,
    eligibilityReason: 'PHQ-9 item 9 = 1, assessmentRequired = true, age 52, specialty_mental_health',
    linkage: LinkageState.QUALIFYING_RECORD_LINKED_WITHIN_WINDOW,
    linkageReason: 'Explicit triggeringScreenId link validated',
    linkedAssessmentId: 'asx-E04',
    candidateAssessmentIds: ['asx-E04'],
    isMature: true,
  },
  {
    screeningEventId: 'scr-E05',
    eligibility: EligibilityState.ELIGIBLE,
    eligibilityReason: 'PHQ-9 item 9 = 2, assessmentRequired = true, age 39, specialty_mental_health',
    linkage: LinkageState.QUALIFYING_RECORD_LINKED_OUTSIDE_WINDOW,
    linkageReason: 'Explicit triggeringScreenId link validated',
    linkedAssessmentId: 'asx-E05',
    candidateAssessmentIds: ['asx-E05'],
    isMature: true,
  },
  {
    screeningEventId: 'scr-E06',
    eligibility: EligibilityState.ELIGIBLE,
    eligibilityReason: 'PHQ-9 item 9 = 1, assessmentRequired = true, age 41, specialty_mental_health',
    linkage: LinkageState.NO_LINKED_RECORD_IN_AVAILABLE_DATA,
    linkageReason: 'No assessment record found for this patient after screen occurrence in supplied data',
    linkedAssessmentId: null,
    candidateAssessmentIds: [],
    isMature: true,
  },
  {
    screeningEventId: 'scr-E07',
    eligibility: EligibilityState.ELIGIBLE,
    eligibilityReason: 'PHQ-9 item 9 = 2, assessmentRequired = true, age 55, specialty_mental_health',
    linkage: LinkageState.NO_LINKED_RECORD_IN_AVAILABLE_DATA,
    linkageReason: 'No assessment record found for this patient after screen occurrence in supplied data',
    linkedAssessmentId: null,
    candidateAssessmentIds: [],
    isMature: true,
  },
  {
    screeningEventId: 'scr-E08',
    eligibility: EligibilityState.ELIGIBLE,
    eligibilityReason: 'PHQ-9 item 9 = 1, assessmentRequired = true, age 33, specialty_mental_health',
    linkage: LinkageState.AMBIGUOUS_LINKAGE,
    linkageReason: 'Multiple candidate assessments without explicit links; cannot resolve without arbitrary selection',
    linkedAssessmentId: null,
    candidateAssessmentIds: ['asx-E08a', 'asx-E08b'],
    isMature: true,
  },
  {
    screeningEventId: 'scr-E09',
    eligibility: EligibilityState.ELIGIBLE,
    eligibilityReason: 'PHQ-9 item 9 = 2, assessmentRequired = true, age 47, specialty_mental_health',
    linkage: LinkageState.AMBIGUOUS_LINKAGE,
    linkageReason: 'Multiple competing screens for same patient assessment; cannot uniquely attribute',
    linkedAssessmentId: null,
    candidateAssessmentIds: ['asx-E09'],
    isMature: true,
  },
  {
    screeningEventId: 'scr-E09b',
    eligibility: EligibilityState.ELIGIBLE,
    eligibilityReason: 'PHQ-9 item 9 = 1, assessmentRequired = true, age 47, specialty_mental_health',
    linkage: LinkageState.AMBIGUOUS_LINKAGE,
    linkageReason: 'Multiple competing screens for same patient assessment; cannot uniquely attribute',
    linkedAssessmentId: null,
    candidateAssessmentIds: ['asx-E09'],
    isMature: true,
  },
  {
    screeningEventId: 'scr-E10',
    eligibility: EligibilityState.ELIGIBLE,
    eligibilityReason: 'PHQ-9 item 9 = 1, assessmentRequired = true, age 29, specialty_mental_health',
    linkage: LinkageState.NOT_YET_EVALUABLE,
    linkageReason: 'Reporting interval (2 business days) has not yet elapsed since screen occurrence',
    linkedAssessmentId: null,
    candidateAssessmentIds: [],
    isMature: false,
  },
  {
    screeningEventId: 'scr-E11',
    eligibility: EligibilityState.ELIGIBLE,
    eligibilityReason: 'PHQ-9 item 9 = 1, assessmentRequired = true, age 36, specialty_mental_health',
    linkage: LinkageState.PARTIAL_OR_NONQUALIFYING_RECORD,
    linkageReason: 'Assessment asx-E11 linked but documentedCompletionFlag = false, documentationStatus = PARTIAL; does not satisfy qualifying assessment predicate',
    linkedAssessmentId: null,
    candidateAssessmentIds: ['asx-E11'],
    isMature: true,
  },
  {
    screeningEventId: 'scr-E12',
    eligibility: EligibilityState.ELIGIBLE,
    eligibilityReason: 'PHQ-9 item 9 = 2, assessmentRequired = true, age 43, specialty_mental_health',
    linkage: LinkageState.DATA_COVERAGE_UNKNOWN,
    linkageReason: 'No linked record found and sourceLocation satellite-clinic-ehr is in knownMissingFeeds; cannot confirm absence',
    linkedAssessmentId: null,
    candidateAssessmentIds: [],
    isMature: true,
  },
  {
    screeningEventId: 'scr-X01',
    eligibility: EligibilityState.NOT_ELIGIBLE,
    eligibilityReason: 'assessmentRequired = false (explicit negative eligibility)',
    linkage: null,
    linkageReason: null,
    linkedAssessmentId: null,
    candidateAssessmentIds: [],
    isMature: true,
  },
  {
    screeningEventId: 'scr-X02',
    eligibility: EligibilityState.NOT_ELIGIBLE,
    eligibilityReason: 'Age 16 is below population minimum age 18',
    linkage: null,
    linkageReason: null,
    linkedAssessmentId: null,
    candidateAssessmentIds: [],
    isMature: true,
  },
  {
    screeningEventId: 'scr-X03',
    eligibility: EligibilityState.NOT_ELIGIBLE,
    eligibilityReason: 'Setting primary_care does not match required specialty_mental_health',
    linkage: null,
    linkageReason: null,
    linkedAssessmentId: null,
    candidateAssessmentIds: [],
    isMature: true,
  },
  {
    screeningEventId: 'scr-U01',
    eligibility: EligibilityState.INDETERMINATE,
    eligibilityReason: 'assessmentRequired is null (missing eligibility field)',
    linkage: null,
    linkageReason: null,
    linkedAssessmentId: null,
    candidateAssessmentIds: [],
    isMature: true,
  },
];

/**
 * Expected summary counts from FIXTURES.md.
 * Includes E09b competing screen: 17 total, 13 eligible, 3 ambiguous.
 */
export const EXPECTED_SUMMARY: Readonly<ReconciliationSummary> = {
  totalScreens: 17,
  eligible: 13,
  matureEligible: 12,
  withinWindow: 4,
  outsideWindow: 1,
  ambiguous: 3,
  immature: 1,
  partial: 1,
  absentLink: 3,
  coverageUnknown: 1,
  notEligible: 3,
  indeterminate: 1,
};

export function verifyExpectedCounts(): void {
  const decisions = EXPECTED_DECISIONS;

  const eligible = decisions.filter((d) => d.eligibility === EligibilityState.ELIGIBLE);
  const matureEligible = eligible.filter((d) => d.isMature);
  const withinWindow = decisions.filter((d) => d.linkage === LinkageState.QUALIFYING_RECORD_LINKED_WITHIN_WINDOW);
  const outsideWindow = decisions.filter((d) => d.linkage === LinkageState.QUALIFYING_RECORD_LINKED_OUTSIDE_WINDOW);
  const ambiguous = decisions.filter((d) => d.linkage === LinkageState.AMBIGUOUS_LINKAGE);
  const immature = decisions.filter((d) => d.linkage === LinkageState.NOT_YET_EVALUABLE);
  const partial = decisions.filter((d) => d.linkage === LinkageState.PARTIAL_OR_NONQUALIFYING_RECORD);
  const noLink = decisions.filter((d) => d.linkage === LinkageState.NO_LINKED_RECORD_IN_AVAILABLE_DATA);
  const coverageUnknown = decisions.filter((d) => d.linkage === LinkageState.DATA_COVERAGE_UNKNOWN);
  const absentLink = [...noLink, ...coverageUnknown];
  const notEligible = decisions.filter((d) => d.eligibility === EligibilityState.NOT_ELIGIBLE);
  const indeterminate = decisions.filter((d) => d.eligibility === EligibilityState.INDETERMINATE);

  const checks: Array<[string, number, number]> = [
    ['totalScreens', decisions.length, EXPECTED_SUMMARY.totalScreens],
    ['eligible', eligible.length, EXPECTED_SUMMARY.eligible],
    ['matureEligible', matureEligible.length, EXPECTED_SUMMARY.matureEligible],
    ['withinWindow', withinWindow.length, EXPECTED_SUMMARY.withinWindow],
    ['outsideWindow', outsideWindow.length, EXPECTED_SUMMARY.outsideWindow],
    ['ambiguous', ambiguous.length, EXPECTED_SUMMARY.ambiguous],
    ['immature', immature.length, EXPECTED_SUMMARY.immature],
    ['partial', partial.length, EXPECTED_SUMMARY.partial],
    ['absentLink', absentLink.length, EXPECTED_SUMMARY.absentLink],
    ['coverageUnknown', coverageUnknown.length, EXPECTED_SUMMARY.coverageUnknown],
    ['notEligible', notEligible.length, EXPECTED_SUMMARY.notEligible],
    ['indeterminate', indeterminate.length, EXPECTED_SUMMARY.indeterminate],
  ];

  const failures = checks.filter(([, actual, expected]) => actual !== expected);
  if (failures.length > 0) {
    const msg = failures
      .map(([name, actual, expected]) => `  ${name}: got ${actual}, expected ${expected}`)
      .join('\n');
    throw new Error(`Expected count verification failed:\n${msg}`);
  }
}
