# SPEC-B: Reconciliation Engine

**Phase:** 2 (0:45-2:15)
**Agent:** reconciliation-engineer
**Depends on:** SPEC-A schema and fixtures
**Produces:** Pure TypeScript reconciliation function passing all known-answer tests

---

## Objective

Implement the 8-step deterministic reconciliation algorithm from PROBLEM.md
Section 6 as a pure TypeScript function with no external dependencies.

## Algorithm

### Step 1: Validate inputs
- Validate organization, identity, schema, source IDs, time fields
- Exact duplicate source records are idempotent
- Conflicting records sharing an ID are quarantined (INVALID)

### Step 2: Pin configuration
- Find applicable ProtocolVersion at screen occurrence time
- Half-open intervals: `[effectiveFrom, effectiveTo)`
- Missing or overlapping versions block evaluation

### Step 3: Determine eligibility
- From supplied fields and configured scope (age, setting, instrument)
- Missing eligibility fields -> INDETERMINATE, not negative
- Explicit negative -> NOT_ELIGIBLE with reason

### Step 4: Find compatible assessments
- Same organization and patient
- Configured instrument/version
- Subsequent occurrence
- Missing timestamps or incompatible status do not qualify

### Step 5: Link assessment
- Prefer validated explicit `triggeringScreenId`
- Validate identity and timing even with explicit link
- Same-encounter fallback only when exactly one candidate and one eligible screen
- Never choose closest timestamp for ambiguity resolution

### Step 6: Detect ambiguity
- Multiple assessments -> AMBIGUOUS_LINKAGE
- Multiple competing screens -> AMBIGUOUS_LINKAGE
- Conflicting links -> AMBIGUOUS_LINKAGE
- No assessment can satisfy two screens

### Step 7: Evaluate reporting interval
- Only after establishing unambiguous link
- Business-day calendar with timezone, weekends, holidays
- Inclusive endpoint
- Links outside interval preserved as QUALIFYING_RECORD_LINKED_OUTSIDE_WINDOW

### Step 8: Emit results
- Machine-readable membership and reason codes
- Every result traces to input IDs, config version, coverage manifest
- Immutable ReconciliationRun

## Business-Day Calendar

```typescript
interface BusinessDayCalendar {
  timezone: string;
  holidays: string[]; // ISO date strings
  weekendDays: number[]; // 0=Sunday, 6=Saturday
}

// Advance N business days from anchor, inclusive of endpoint
function addBusinessDays(
  anchor: Date,
  days: number,
  calendar: BusinessDayCalendar
): Date;
```

The deadline preserves local wall-clock time after advancing two eligible
local dates. This is a reporting convention, not a clinical deadline.

## Types

```typescript
type EligibilityState =
  | 'ELIGIBLE'
  | 'NOT_ELIGIBLE'
  | 'INDETERMINATE'
  | 'INVALID';

type LinkageState =
  | 'QUALIFYING_RECORD_LINKED_WITHIN_WINDOW'
  | 'QUALIFYING_RECORD_LINKED_OUTSIDE_WINDOW'
  | 'NO_LINKED_RECORD_IN_AVAILABLE_DATA'
  | 'AMBIGUOUS_LINKAGE'
  | 'PARTIAL_OR_NONQUALIFYING_RECORD'
  | 'NOT_YET_EVALUABLE'
  | 'DATA_COVERAGE_UNKNOWN';

interface ReconciliationDecision {
  screeningEventId: string;
  eligibility: EligibilityState;
  eligibilityReason: string;
  linkage?: LinkageState;
  linkageReason?: string;
  linkedAssessmentId?: string;
  candidateAssessmentIds: string[];
  configVersionId: string;
  measureDefinitionId: string;
  maturityStatus: 'MATURE' | 'IMMATURE';
  coverageStatus: string;
  reasonCodes: string[];
}

interface ReconciliationResult {
  configurationHash: string;
  engineVersion: string;
  asOf: Date;
  extractionHash: string;
  decisions: ReconciliationDecision[];
  summary: ReconciliationSummary;
}
```

## Deliverables

1. Pure `reconcile()` function with no side effects
2. Business-day calendar implementation
3. All E01-E12, X01-X03, U01 fixtures passing
4. Boundary tests: weekend, holiday, timezone, inclusive endpoint
5. Adversarial tests: duplicates, cross-patient, reuse
6. `tsc --noEmit` passes
