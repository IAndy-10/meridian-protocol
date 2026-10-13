/**
 * Pure deterministic reconciliation engine.
 * No side effects, no LLM, no probabilistic matching.
 * Implements the 8-step algorithm from PROBLEM.md Section 6.
 */
import {
  EligibilityState,
  LinkageState,
  ReconciliationDecision,
  ReconciliationSummary,
} from '@app-starter/shared';
import { isIntervalMature, isWithinBusinessDayWindow } from './business-day-calendar';
import {
  AssessmentEventInput,
  CoverageManifestInput,
  MeasureDefinitionInput,
  ProtocolVersionInput,
  ReconciliationInput,
  ScreeningEventInput,
} from './types';
import { createHash } from 'crypto';

export interface ReconciliationResult {
  configurationHash: string;
  engineVersion: string;
  asOf: Date;
  extractionHash: string;
  decisions: ReconciliationDecision[];
  summary: ReconciliationSummary;
}

/**
 * Main entry point. Pure function — deterministic and side-effect-free.
 *
 * Two-pass algorithm:
 * Pass 1: Validate, pin config, determine eligibility, find candidates per screen.
 * Pass 2: Detect competing screens across all eligible screens sharing candidates,
 *          then resolve linkage.
 */
export function reconcile(input: ReconciliationInput): ReconciliationResult {
  const {
    organizationId,
    screens,
    assessments,
    protocolVersions,
    coverage,
    calendar,
    asOf,
    engineVersion,
  } = input;

  // Step 1: Validate inputs
  const { validScreens, quarantinedScreenIds, validAssessments, quarantinedAssessmentIds } =
    validateInputs(screens, assessments, organizationId);

  // --- Pass 1: eligibility + candidate discovery ---
  interface ScreenContext {
    screen: ScreeningEventInput;
    protocolVersion: ProtocolVersionInput;
    measureDef: MeasureDefinitionInput;
    eligibility: EligibilityResult;
    candidates: AssessmentEventInput[];
  }
  const eligibleContexts: ScreenContext[] = [];
  const decisions: ReconciliationDecision[] = [];

  // We'll fill decisions for non-eligible screens now, eligible screens in pass 2
  const deferredScreenIds = new Set<string>();

  for (const screen of validScreens) {
    if (quarantinedScreenIds.has(screen.id)) {
      decisions.push(makeInvalidDecision(screen, 'Conflicting duplicate source records quarantined'));
      continue;
    }

    const configResult = pinConfigVersion(screen, protocolVersions, organizationId);
    if (configResult.error) {
      decisions.push(makeInvalidDecision(screen, configResult.error));
      continue;
    }

    const protocolVersion = configResult.protocolVersion!;
    const measureDef = configResult.measureDefinition!;
    const eligibility = determineEligibility(screen, measureDef);

    if (eligibility.state !== EligibilityState.ELIGIBLE) {
      decisions.push({
        screeningEventId: screen.id,
        eligibility: eligibility.state,
        eligibilityReason: eligibility.reason,
        linkage: null,
        linkageReason: null,
        linkedAssessmentId: null,
        candidateAssessmentIds: [],
        isMature: true,
        protocolVersionId: protocolVersion.id,
        measureDefinitionId: measureDef.id,
      });
      continue;
    }

    const candidates = findCompatibleAssessments(screen, validAssessments, quarantinedAssessmentIds);
    eligibleContexts.push({ screen, protocolVersion, measureDef, eligibility, candidates });
    deferredScreenIds.add(screen.id);
  }

  // --- Pass 2: detect competing screens, then resolve linkage ---
  // Build map: assessmentId -> set of eligible screenIds that could claim it
  const assessmentClaimants = new Map<string, Set<string>>();
  for (const ctx of eligibleContexts) {
    for (const candidate of ctx.candidates) {
      let claimants = assessmentClaimants.get(candidate.id);
      if (!claimants) {
        claimants = new Set();
        assessmentClaimants.set(candidate.id, claimants);
      }
      claimants.add(ctx.screen.id);
    }
  }

  // A screen is "competing" if any of its candidate assessments are also candidates
  // for another eligible screen, AND none of those assessments have explicit
  // triggeringScreenId pointing to this screen exclusively
  function _isCompetingScreen(ctx: ScreenContext): boolean {
    for (const candidate of ctx.candidates) {
      const claimants = assessmentClaimants.get(candidate.id);
      if (!claimants || claimants.size <= 1) continue;
      // Multiple screens claim this assessment
      // If the assessment has an explicit link to exactly this screen, it's not competing
      if (candidate.triggeringScreenId === ctx.screen.id) {
        // But if other screens also have explicit links to the same assessment, that's still competition
        // Check if any other claimant also has an explicit link via another assessment
        continue;
      }
      // No explicit link to this screen — competition
      return true;
    }
    return false;
  }

  const assessmentUsedBy = new Map<string, string>();

  for (const ctx of eligibleContexts) {
    const { screen, protocolVersion, measureDef, eligibility, candidates } = ctx;

    const mature = isIntervalMature(screen.occurredAt, measureDef.reportingIntervalDays, calendar, asOf);
    const candidateIds = candidates.map((c) => c.id);

    // Step 5 & 6: Link assessment, detect ambiguity
    const linkResult = linkAssessment(screen, candidates, assessmentClaimants, assessmentUsedBy);

    let linkage: LinkageState | null = null;
    let linkageReason: string | null = null;
    let linkedAssessmentId: string | null = null;

    if (linkResult.type === 'linked') {
      const linkedAsx = validAssessments.find((a) => a.id === linkResult.assessmentId)!;
      if (!doesAssessmentQualify(linkedAsx)) {
        linkage = LinkageState.PARTIAL_OR_NONQUALIFYING_RECORD;
        linkageReason = `Assessment ${linkedAsx.id} linked but documentedCompletionFlag = ${linkedAsx.documentedCompletionFlag}, documentationStatus = ${linkedAsx.documentationStatus}; does not satisfy qualifying assessment predicate`;
      } else {
        const withinWindow = isWithinBusinessDayWindow(
          screen.occurredAt, linkedAsx.performedAt, measureDef.reportingIntervalDays, calendar,
        );
        linkage = withinWindow
          ? LinkageState.QUALIFYING_RECORD_LINKED_WITHIN_WINDOW
          : LinkageState.QUALIFYING_RECORD_LINKED_OUTSIDE_WINDOW;
        linkedAssessmentId = linkedAsx.id;
        linkageReason = linkResult.reason;
      }
    } else if (linkResult.type === 'ambiguous') {
      linkage = LinkageState.AMBIGUOUS_LINKAGE;
      linkageReason = linkResult.reason;
    } else {
      if (!mature) {
        linkage = LinkageState.NOT_YET_EVALUABLE;
        linkageReason = `Reporting interval (${measureDef.reportingIntervalDays} business days) has not yet elapsed since screen occurrence`;
      } else {
        const hasCoverageGap = checkCoverageGap(screen, coverage);
        if (hasCoverageGap) {
          linkage = LinkageState.DATA_COVERAGE_UNKNOWN;
          linkageReason = `No linked record found and sourceLocation ${screen.sourceLocation} is in knownMissingFeeds; cannot confirm absence`;
        } else {
          linkage = LinkageState.NO_LINKED_RECORD_IN_AVAILABLE_DATA;
          linkageReason = 'No assessment record found for this patient after screen occurrence in supplied data';
        }
      }
    }

    if (linkedAssessmentId !== null) {
      assessmentUsedBy.set(linkedAssessmentId, screen.id);
    }

    decisions.push({
      screeningEventId: screen.id,
      eligibility: EligibilityState.ELIGIBLE,
      eligibilityReason: eligibility.reason,
      linkage,
      linkageReason,
      linkedAssessmentId,
      candidateAssessmentIds: candidateIds,
      isMature: mature,
      protocolVersionId: protocolVersion.id,
      measureDefinitionId: measureDef.id,
    });
  }

  const summary = computeSummary(decisions);
  const configurationHash = hashConfig(protocolVersions);
  const extractionHash = hashExtraction(screens, assessments);

  return { configurationHash, engineVersion, asOf, extractionHash, decisions, summary };
}

function makeInvalidDecision(screen: ScreeningEventInput, reason: string): ReconciliationDecision {
  return {
    screeningEventId: screen.id,
    eligibility: EligibilityState.INVALID,
    eligibilityReason: reason,
    linkage: null,
    linkageReason: null,
    linkedAssessmentId: null,
    candidateAssessmentIds: [],
    isMature: true,
    protocolVersionId: null,
    measureDefinitionId: null,
  };
}

// ---------------------------------------------------------------------------
// Step 1: Validate inputs
// ---------------------------------------------------------------------------

function validateInputs(
  screens: ScreeningEventInput[],
  assessments: AssessmentEventInput[],
  organizationId: string,
) {
  const validScreens: ScreeningEventInput[] = [];
  const quarantinedScreenIds = new Set<string>();
  const seenScreenSourceKeys = new Map<string, ScreeningEventInput>();

  for (const screen of screens) {
    if (screen.organizationId !== organizationId) continue;
    const sourceKey = `${screen.sourceRecordId}|${screen.sourceSystem}`;
    const existing = seenScreenSourceKeys.get(sourceKey);
    if (existing) {
      if (existing.provenanceHash === screen.provenanceHash) continue; // idempotent
      quarantinedScreenIds.add(existing.id);
      quarantinedScreenIds.add(screen.id);
      validScreens.push(screen);
      continue;
    }
    seenScreenSourceKeys.set(sourceKey, screen);
    validScreens.push(screen);
  }

  const validAssessments: AssessmentEventInput[] = [];
  const quarantinedAssessmentIds = new Set<string>();
  const seenAsxSourceKeys = new Map<string, AssessmentEventInput>();

  for (const a of assessments) {
    if (a.organizationId !== organizationId) continue;
    const sourceKey = `${a.sourceRecordId}|${a.sourceSystem}`;
    const existing = seenAsxSourceKeys.get(sourceKey);
    if (existing) {
      if (existing.provenanceHash === a.provenanceHash) continue;
      quarantinedAssessmentIds.add(existing.id);
      quarantinedAssessmentIds.add(a.id);
      validAssessments.push(a);
      continue;
    }
    seenAsxSourceKeys.set(sourceKey, a);
    validAssessments.push(a);
  }

  return { validScreens, quarantinedScreenIds, validAssessments, quarantinedAssessmentIds };
}

// ---------------------------------------------------------------------------
// Step 2: Pin config version
// ---------------------------------------------------------------------------

interface ConfigPinResult {
  protocolVersion?: ProtocolVersionInput;
  measureDefinition?: MeasureDefinitionInput;
  error?: string;
}

function pinConfigVersion(
  screen: ScreeningEventInput,
  versions: ProtocolVersionInput[],
  organizationId: string,
): ConfigPinResult {
  const applicable = versions.filter((v) => {
    if (v.organizationId !== organizationId) return false;
    if (screen.occurredAt < v.effectiveFrom) return false;
    if (v.effectiveTo !== null && screen.occurredAt >= v.effectiveTo) return false;
    return true;
  });

  if (applicable.length === 0) return { error: 'No applicable configuration version at screen occurrence time' };
  if (applicable.length > 1) return { error: 'Overlapping configuration versions at screen occurrence time; cannot evaluate' };

  const pv = applicable[0];
  if (pv.measureDefinitions.length === 0) return { error: 'Configuration version has no measure definitions' };
  return { protocolVersion: pv, measureDefinition: pv.measureDefinitions[0] };
}

// ---------------------------------------------------------------------------
// Step 3: Determine eligibility
// ---------------------------------------------------------------------------

interface EligibilityResult {
  state: EligibilityState;
  reason: string;
}

function determineEligibility(screen: ScreeningEventInput, measureDef: MeasureDefinitionInput): EligibilityResult {
  if (measureDef.populationMinAge !== null && screen.ageAtEvent < measureDef.populationMinAge) {
    return { state: EligibilityState.NOT_ELIGIBLE, reason: `Age ${screen.ageAtEvent} is below population minimum age ${measureDef.populationMinAge}` };
  }
  if (screen.setting !== measureDef.settingFilter) {
    return { state: EligibilityState.NOT_ELIGIBLE, reason: `Setting ${screen.setting} does not match required ${measureDef.settingFilter}` };
  }
  if (screen.assessmentRequired === null) {
    return { state: EligibilityState.INDETERMINATE, reason: 'assessmentRequired is null (missing eligibility field)' };
  }
  if (screen.assessmentRequired === false) {
    return { state: EligibilityState.NOT_ELIGIBLE, reason: 'assessmentRequired = false (explicit negative eligibility)' };
  }
  const item9Desc = screen.item9Value !== null ? `item 9 = ${screen.item9Value}` : 'item 9 value not supplied';
  return { state: EligibilityState.ELIGIBLE, reason: `PHQ-9 ${item9Desc}, assessmentRequired = true, age ${screen.ageAtEvent}, ${screen.setting}` };
}

// ---------------------------------------------------------------------------
// Step 4: Find compatible assessments
// ---------------------------------------------------------------------------

function findCompatibleAssessments(
  screen: ScreeningEventInput,
  assessments: AssessmentEventInput[],
  quarantinedIds: Set<string>,
): AssessmentEventInput[] {
  return assessments.filter((a) => {
    if (quarantinedIds.has(a.id)) return false;
    if (a.organizationId !== screen.organizationId) return false;
    if (a.syntheticPatientId !== screen.syntheticPatientId) return false;
    if (a.performedAt < screen.occurredAt) return false;
    if (a.instrumentName !== 'C-SSRS') return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// Step 5 & 6: Link assessment / detect ambiguity
// ---------------------------------------------------------------------------

interface LinkResult {
  type: 'linked' | 'ambiguous' | 'none';
  assessmentId?: string;
  candidateIds: string[];
  reason: string;
}

function linkAssessment(
  screen: ScreeningEventInput,
  candidates: AssessmentEventInput[],
  assessmentClaimants: Map<string, Set<string>>,
  assessmentUsedBy: Map<string, string>,
): LinkResult {
  if (candidates.length === 0) {
    return { type: 'none', candidateIds: [], reason: 'No compatible assessments found' };
  }

  const candidateIds = candidates.map((c) => c.id);

  // Check explicit triggeringScreenId links
  const explicitLinks = candidates.filter((c) => c.triggeringScreenId === screen.id);

  // Validate explicit links (patient, org, timing)
  const validExplicitLinks = explicitLinks.filter((c) => {
    if (c.organizationId !== screen.organizationId) return false;
    if (c.syntheticPatientId !== screen.syntheticPatientId) return false;
    if (c.performedAt < screen.occurredAt) return false;
    return true;
  });

  // Check reuse
  const unreusedLinks = validExplicitLinks.filter((c) => {
    const usedBy = assessmentUsedBy.get(c.id);
    return usedBy === undefined || usedBy === screen.id;
  });

  if (unreusedLinks.length > 1) {
    return {
      type: 'ambiguous',
      candidateIds,
      reason: `Multiple candidate assessments (${unreusedLinks.map((c) => c.id).join(', ')}) both reference this screen; cannot select one without arbitrary tie-breaking`,
    };
  }

  if (unreusedLinks.length === 1) {
    return { type: 'linked', assessmentId: unreusedLinks[0].id, candidateIds, reason: 'Explicit triggeringScreenId link validated' };
  }

  // No explicit link to this screen — check for competing screens
  // An assessment is contested if multiple eligible screens claim it
  for (const candidate of candidates) {
    const claimants = assessmentClaimants.get(candidate.id);
    if (claimants && claimants.size > 1) {
      // Check if the assessment has an explicit link to someone else
      // If it has no explicit link, multiple screens competing = ambiguous
      if (candidate.triggeringScreenId === null) {
        return {
          type: 'ambiguous',
          candidateIds,
          reason: 'Multiple competing screens for same patient assessment; cannot uniquely attribute',
        };
      }
      // If it has an explicit link to another screen, this screen can't claim it
    }
  }

  // Multiple candidates without explicit links
  if (candidates.length > 1) {
    return {
      type: 'ambiguous',
      candidateIds,
      reason: 'Multiple candidate assessments without explicit links; cannot resolve without arbitrary selection',
    };
  }

  // Exactly one candidate, no explicit link — try same-encounter fallback
  const candidate = candidates[0];
  if (candidate.triggeringScreenId === null && candidate.encounterId === screen.encounterId) {
    const usedBy = assessmentUsedBy.get(candidate.id);
    if (usedBy === undefined) {
      return {
        type: 'linked',
        assessmentId: candidate.id,
        candidateIds,
        reason: 'Same-encounter fallback: exactly one candidate assessment with no explicit link in same encounter',
      };
    }
  }

  return { type: 'none', candidateIds, reason: 'No linkable assessment found' };
}

// ---------------------------------------------------------------------------
// Assessment qualification
// ---------------------------------------------------------------------------

function doesAssessmentQualify(a: AssessmentEventInput): boolean {
  if (a.documentedCompletionFlag !== true) return false;
  if (a.documentationStatus !== 'COMPLETED') return false;
  return true;
}

// ---------------------------------------------------------------------------
// Coverage gap
// ---------------------------------------------------------------------------

function checkCoverageGap(screen: ScreeningEventInput, coverage: CoverageManifestInput): boolean {
  return screen.sourceLocation !== null && coverage.knownMissingFeeds.includes(screen.sourceLocation);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

function computeSummary(decisions: ReconciliationDecision[]): ReconciliationSummary {
  const eligible = decisions.filter((d) => d.eligibility === EligibilityState.ELIGIBLE);
  return {
    totalScreens: decisions.length,
    eligible: eligible.length,
    matureEligible: eligible.filter((d) => d.isMature).length,
    withinWindow: decisions.filter((d) => d.linkage === LinkageState.QUALIFYING_RECORD_LINKED_WITHIN_WINDOW).length,
    outsideWindow: decisions.filter((d) => d.linkage === LinkageState.QUALIFYING_RECORD_LINKED_OUTSIDE_WINDOW).length,
    ambiguous: decisions.filter((d) => d.linkage === LinkageState.AMBIGUOUS_LINKAGE).length,
    immature: decisions.filter((d) => d.linkage === LinkageState.NOT_YET_EVALUABLE).length,
    partial: decisions.filter((d) => d.linkage === LinkageState.PARTIAL_OR_NONQUALIFYING_RECORD).length,
    absentLink: decisions.filter((d) => d.linkage === LinkageState.NO_LINKED_RECORD_IN_AVAILABLE_DATA || d.linkage === LinkageState.DATA_COVERAGE_UNKNOWN).length,
    coverageUnknown: decisions.filter((d) => d.linkage === LinkageState.DATA_COVERAGE_UNKNOWN).length,
    notEligible: decisions.filter((d) => d.eligibility === EligibilityState.NOT_ELIGIBLE).length,
    indeterminate: decisions.filter((d) => d.eligibility === EligibilityState.INDETERMINATE).length,
  };
}

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

function hashConfig(versions: ProtocolVersionInput[]): string {
  return createHash('sha256').update(JSON.stringify(versions)).digest('hex').slice(0, 16);
}

function hashExtraction(screens: ScreeningEventInput[], assessments: AssessmentEventInput[]): string {
  const data = JSON.stringify({ s: screens.map((s) => s.id).sort(), a: assessments.map((a) => a.id).sort() });
  return createHash('sha256').update(data).digest('hex').slice(0, 16);
}
