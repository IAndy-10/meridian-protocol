# AegisBrain Concrete Fixture Dataset

All data is synthetic. All times are in `America/Los_Angeles` (Pacific).

---

## Organization

| Field | Value |
|-------|-------|
| id | `org-aegis-001` |
| name | Cascadia Behavioral Health (fictional) |
| HydraDB database | `org_aegis_001` |

---

## Calendar (v1)

- Timezone: `America/Los_Angeles`
- Weekend days: Saturday (6), Sunday (0)
- Holidays: `2026-09-07` (Labor Day), `2026-11-26` (Thanksgiving)
- Version: `cal-v1`

---

## Protocol Versions

### v1.0

| Field | Value |
|-------|-------|
| id | `pv-1` |
| version | `1.0` |
| approvalStatus | `APPROVED_SYNTHETIC` |
| isSynthetic | `true` |
| approverLabel | `Synthetic QI Committee` |
| effectiveFrom | `2026-06-01T00:00:00-07:00` |
| effectiveTo | `2026-10-01T00:00:00-07:00` |
| sourceArtifactId | `sa-synth-proc-1` |
| timezone | `America/Los_Angeles` |
| calendarVersion | `cal-v1` |
| responsibleClinicalRole | `Attending Psychiatrist` |
| operationalReviewRole | `QI Analyst` |

### v2.0

| Field | Value |
|-------|-------|
| id | `pv-2` |
| version | `2.0` |
| approvalStatus | `APPROVED_SYNTHETIC` |
| isSynthetic | `true` |
| approverLabel | `Synthetic QI Committee` |
| effectiveFrom | `2026-10-01T00:00:00-07:00` |
| effectiveTo | `null` (open-ended) |
| sourceArtifactId | `sa-synth-proc-2` |
| timezone | `America/Los_Angeles` |
| calendarVersion | `cal-v1` |
| responsibleClinicalRole | `Attending Psychiatrist` |
| operationalReviewRole | `QI Analyst` |

Half-open intervals: v1.0 covers `[2026-06-01, 2026-10-01)`, v2.0 covers `[2026-10-01, ...)`.

---

## Measure Definitions

### md-1 (under pv-1)

| Field | Value |
|-------|-------|
| id | `md-1` |
| version | `1.0` |
| protocolVersionId | `pv-1` |
| populationMinAge | `18` |
| settingFilter | `specialty_mental_health` |
| eligibilityRule | `PHQ-9 item 9 >= 1 AND assessmentRequired = true` |
| qualifyingAssessment | `C-SSRS with documentedCompletionFlag = true` |
| linkageRules | `Prefer explicit triggeringScreenId; fallback to same-encounter if exactly 1 candidate and 1 eligible screen; no closest-timestamp selection; no assessment reuse` |
| reportingIntervalDays | `2` |
| timeAnchor | `screen_occurrence` |
| boundaryInclusivity | `inclusive` |
| duplicatePolicy | `Exact duplicate source records idempotent; conflicting records with same sourceRecordId quarantined as INVALID` |
| exclusionPolicy | `Age < 18 excluded; setting != specialty_mental_health excluded; explicit assessmentRequired = false excluded` |

### md-2 (under pv-2) — identical rules, different protocol version

| Field | Value |
|-------|-------|
| id | `md-2` |
| version | `2.0` |
| protocolVersionId | `pv-2` |
| (all other fields same as md-1) | |

---

## Source Artifacts

| id | kind | title |
|----|------|-------|
| `sa-p1` | PUBLICATION | Coleman et al. 2021 — Identifying People at Risk for Suicide |
| `sa-p2` | PUBLICATION | Yarborough et al. 2019 — Challenges of Population-based Measurement |
| `sa-p3` | PUBLICATION | Richards et al. 2021 — Implementation Evaluation of Zero Suicide |
| `sa-p4` | PUBLICATION | Boggs et al. 2024 — Suicide Screening, Risk Assessment |
| `sa-p5` | PUBLICATION | Ahmedani et al. 2025 — Zero Suicide Model and Suicide Attempt Rates |
| `sa-p6` | PUBLICATION | NIMH ASQ Toolkit Materials |
| `sa-synth-proc-1` | SYNTHETIC_PROCEDURE | Cascadia BH Screening-to-Assessment Protocol v1.0 |
| `sa-synth-proc-2` | SYNTHETIC_PROCEDURE | Cascadia BH Screening-to-Assessment Protocol v2.0 |

All have excerpt text, URLs from PROBLEM.md Section 16, and contentHash.

---

## Screening Events

All screens use: `organizationId = org-aegis-001`, `instrumentName = PHQ-9`, `instrumentVersion = 9.0`, `sourceSystem = synthetic-ehr`.

Reconciliation run `asOf = 2026-10-12T08:00:00-07:00`.

| id | syntheticPatientId | encounterId | occurredAt | recordedAt | ageAtEvent | setting | item9Value | assessmentRequired | eligibilityRuleVersion | sourceRecordId |
|----|--------------------|-------------|------------|------------|------------|---------|------------|-------------------|----------------------|----------------|
| `scr-E01` | `SP-001` | `enc-001` | `2026-08-03T09:30:00-07:00` (Mon) | `2026-08-03T09:35:00-07:00` | 34 | `specialty_mental_health` | 2 | `true` | `md-1` | `SRC-SCR-001` |
| `scr-E02` | `SP-002` | `enc-002` | `2026-08-10T14:00:00-07:00` (Mon) | `2026-08-10T14:05:00-07:00` | 45 | `specialty_mental_health` | 1 | `true` | `md-1` | `SRC-SCR-002` |
| `scr-E03` | `SP-003` | `enc-003` | `2026-08-14T10:00:00-07:00` (Fri) | `2026-08-14T10:10:00-07:00` | 28 | `specialty_mental_health` | 3 | `true` | `md-1` | `SRC-SCR-003` |
| `scr-E04` | `SP-004` | `enc-004` | `2026-09-04T11:00:00-07:00` (Fri before Labor Day) | `2026-09-04T11:05:00-07:00` | 52 | `specialty_mental_health` | 1 | `true` | `md-1` | `SRC-SCR-004` |
| `scr-E05` | `SP-005` | `enc-005` | `2026-08-17T09:00:00-07:00` (Mon) | `2026-08-17T09:05:00-07:00` | 39 | `specialty_mental_health` | 2 | `true` | `md-1` | `SRC-SCR-005` |
| `scr-E06` | `SP-006` | `enc-006` | `2026-08-20T10:00:00-07:00` (Thu) | `2026-08-20T10:05:00-07:00` | 41 | `specialty_mental_health` | 1 | `true` | `md-1` | `SRC-SCR-006` |
| `scr-E07` | `SP-007` | `enc-007` | `2026-08-24T09:00:00-07:00` (Mon) | `2026-08-24T09:05:00-07:00` | 55 | `specialty_mental_health` | 2 | `true` | `md-1` | `SRC-SCR-007` |
| `scr-E08` | `SP-008` | `enc-008` | `2026-08-26T10:00:00-07:00` (Wed) | `2026-08-26T10:05:00-07:00` | 33 | `specialty_mental_health` | 1 | `true` | `md-1` | `SRC-SCR-008` |
| `scr-E09` | `SP-009` | `enc-009` | `2026-08-31T09:00:00-07:00` (Mon) | `2026-08-31T09:05:00-07:00` | 47 | `specialty_mental_health` | 2 | `true` | `md-1` | `SRC-SCR-009` |
| `scr-E09b` | `SP-009` | `enc-009b` | `2026-09-01T09:00:00-07:00` (Tue) | `2026-09-01T09:05:00-07:00` | 47 | `specialty_mental_health` | 1 | `true` | `md-1` | `SRC-SCR-009B` |
| `scr-E10` | `SP-010` | `enc-010` | `2026-10-11T14:00:00-07:00` (Sun — but recorded Mon) | `2026-10-12T07:30:00-07:00` | 29 | `specialty_mental_health` | 1 | `true` | `md-2` | `SRC-SCR-010` |
| `scr-E11` | `SP-011` | `enc-011` | `2026-08-19T10:00:00-07:00` (Wed) | `2026-08-19T10:05:00-07:00` | 36 | `specialty_mental_health` | 1 | `true` | `md-1` | `SRC-SCR-011` |
| `scr-E12` | `SP-012` | `enc-012` | `2026-09-15T09:00:00-07:00` (Mon) | `2026-09-15T09:05:00-07:00` | 43 | `specialty_mental_health` | 2 | `true` | `md-1` | `SRC-SCR-012` |
| `scr-X01` | `SP-013` | `enc-013` | `2026-08-05T10:00:00-07:00` (Wed) | `2026-08-05T10:05:00-07:00` | 38 | `specialty_mental_health` | 0 | `false` | `md-1` | `SRC-SCR-013` |
| `scr-X02` | `SP-014` | `enc-014` | `2026-08-07T11:00:00-07:00` (Fri) | `2026-08-07T11:05:00-07:00` | 16 | `specialty_mental_health` | 2 | `true` | `md-1` | `SRC-SCR-014` |
| `scr-X03` | `SP-015` | `enc-015` | `2026-08-11T09:30:00-07:00` (Tue) | `2026-08-11T09:35:00-07:00` | 42 | `primary_care` | 1 | `true` | `md-1` | `SRC-SCR-015` |
| `scr-U01` | `SP-016` | `enc-016` | `2026-08-12T14:00:00-07:00` (Wed) | `2026-08-12T14:05:00-07:00` | 31 | `specialty_mental_health` | 1 | `null` | `md-1` | `SRC-SCR-016` |

### Key date reasoning

| Screen | occurredAt day | +1 biz day | +2 biz days (deadline, inclusive) |
|--------|---------------|------------|-----------------------------------|
| E01 | Mon Aug 3 | Tue Aug 4 | **Wed Aug 5** |
| E02 | Mon Aug 10 | Tue Aug 11 | **Wed Aug 12** |
| E03 | Fri Aug 14 | Mon Aug 17 | **Tue Aug 18** (skips weekend) |
| E04 | Fri Sep 4 | Tue Sep 8 | **Wed Sep 9** (skips Sat+Sun+Labor Day Sep 7) |
| E05 | Mon Aug 17 | Tue Aug 18 | **Wed Aug 19** |
| E10 | Sun Oct 11 | Mon Oct 12 | **Tue Oct 13** (anchor is occurrence, first biz day is Mon) |
| E11 | Wed Aug 19 | Thu Aug 20 | **Fri Aug 21** |

---

## Assessment Events

All assessments use: `organizationId = org-aegis-001`, `instrumentName = C-SSRS`, `instrumentVersion = screener`, `sourceSystem = synthetic-ehr`.

| id | syntheticPatientId | encounterId | triggeringScreenId | performedAt | recordedAt | documentationStatus | documentedCompletionFlag | sourceRecordId |
|----|--------------------|-------------|--------------------|-------------|------------|--------------------|--------------------------| ---------------|
| `asx-E01` | `SP-001` | `enc-001a` | `scr-E01` | `2026-08-04T14:00:00-07:00` (Tue, day 1) | `2026-08-04T14:30:00-07:00` | `COMPLETED` | `true` | `SRC-ASX-001` |
| `asx-E02` | `SP-002` | `enc-002` | `null` | `2026-08-10T15:00:00-07:00` (same encounter, same day) | `2026-08-10T15:10:00-07:00` | `COMPLETED` | `true` | `SRC-ASX-002` |
| `asx-E03` | `SP-003` | `enc-003a` | `scr-E03` | `2026-08-18T09:00:00-07:00` (Tue, biz day 2) | `2026-08-18T09:30:00-07:00` | `COMPLETED` | `true` | `SRC-ASX-003` |
| `asx-E04` | `SP-004` | `enc-004a` | `scr-E04` | `2026-09-09T10:00:00-07:00` (Wed, biz day 2 after holiday) | `2026-09-09T10:15:00-07:00` | `COMPLETED` | `true` | `SRC-ASX-004` |
| `asx-E05` | `SP-005` | `enc-005a` | `scr-E05` | `2026-08-21T10:00:00-07:00` (Thu, biz day 4 — OUTSIDE window) | `2026-08-21T10:30:00-07:00` | `COMPLETED` | `true` | `SRC-ASX-005` |
| `asx-E08a` | `SP-008` | `enc-008a` | `null` | `2026-08-27T09:00:00-07:00` (Thu) | `2026-08-27T09:30:00-07:00` | `COMPLETED` | `true` | `SRC-ASX-008A` |
| `asx-E08b` | `SP-008` | `enc-008b` | `null` | `2026-08-27T14:00:00-07:00` (Thu) | `2026-08-27T14:30:00-07:00` | `COMPLETED` | `true` | `SRC-ASX-008B` |
| `asx-E09` | `SP-009` | `enc-009c` | `null` | `2026-09-01T11:00:00-07:00` (Tue) | `2026-09-01T11:30:00-07:00` | `COMPLETED` | `true` | `SRC-ASX-009` |
| `asx-E11` | `SP-011` | `enc-011a` | `scr-E11` | `2026-08-20T10:00:00-07:00` (Thu, biz day 1) | `2026-08-20T10:30:00-07:00` | `PARTIAL` | `false` | `SRC-ASX-011` |

### No assessment records exist for

- **SP-006** (E06): No C-SSRS record anywhere in supplied data, feeds complete
- **SP-007** (E07): No C-SSRS record anywhere in supplied data, feeds complete
- **SP-010** (E10): No assessment yet — interval not mature (asOf is Oct 12, deadline is Oct 13)
- **SP-012** (E12): No C-SSRS record, but coverage manifest declares a missing feed

---

## Assessment linkage reasoning

| Case | Mechanism | Result |
|------|-----------|--------|
| **E01** | Explicit `triggeringScreenId = scr-E01`, same patient, subsequent, within window (day 1) | `QUALIFYING_RECORD_LINKED_WITHIN_WINDOW` |
| **E02** | No explicit link, but same encounter `enc-002`, exactly 1 candidate + 1 screen → same-encounter fallback. Same day = within window | `QUALIFYING_RECORD_LINKED_WITHIN_WINDOW` |
| **E03** | Explicit link, Fri screen → Mon+Tue = biz day 2 (inclusive). Within window | `QUALIFYING_RECORD_LINKED_WITHIN_WINDOW` |
| **E04** | Explicit link, Fri Sep 4 → skip Sat+Sun+Labor Day → Tue Sep 8 (day 1), Wed Sep 9 (day 2). Assessment on Wed Sep 9 = within window | `QUALIFYING_RECORD_LINKED_WITHIN_WINDOW` |
| **E05** | Explicit link, Mon Aug 17 → Tue (day 1), Wed Aug 19 (day 2 = deadline). Assessment on Thu Aug 21 = day 4. Outside window | `QUALIFYING_RECORD_LINKED_OUTSIDE_WINDOW` |
| **E06** | No assessment record for SP-006 in any feed. Feeds complete | `NO_LINKED_RECORD_IN_AVAILABLE_DATA` |
| **E07** | No assessment record for SP-007 in any feed. Feeds complete | `NO_LINKED_RECORD_IN_AVAILABLE_DATA` |
| **E08** | Two assessments (`asx-E08a`, `asx-E08b`) for SP-008, neither has explicit link. Multiple candidates → ambiguous | `AMBIGUOUS_LINKAGE` |
| **E09** | Assessment `asx-E09` performed Tue Sep 1 for SP-009. Two competing screens: `scr-E09` (Mon Aug 31) and `scr-E09b` (Tue Sep 1). Both eligible, both could claim this assessment. Neither has explicit link → competing screens = ambiguous | `AMBIGUOUS_LINKAGE` |
| **E09b** | Same competition as E09 — this screen also gets `AMBIGUOUS_LINKAGE` | `AMBIGUOUS_LINKAGE` |
| **E10** | Screen Oct 11 (Sun). Deadline = Tue Oct 13. asOf = Oct 12. Interval not yet mature | `NOT_YET_EVALUABLE` |
| **E11** | Explicit link to `asx-E11`, but `documentedCompletionFlag = false`, `documentationStatus = PARTIAL` → does not meet qualifying predicate | `PARTIAL_OR_NONQUALIFYING_RECORD` |
| **E12** | No assessment record for SP-012. Coverage manifest lists missing feed `satellite-clinic-ehr` | `DATA_COVERAGE_UNKNOWN` |

---

## Coverage Manifest

| Field | Value |
|-------|-------|
| locationsIncluded | `["main-campus-ehr", "telehealth-platform"]` |
| locationsOmitted | `["satellite-clinic-ehr"]` |
| extractionCutoff | `2026-10-12T06:00:00-07:00` |
| dataWatermark | `2026-10-11T23:59:59-07:00` |
| knownMissingFeeds | `["satellite-clinic-ehr"]` |
| coverageStatus | `PARTIAL` |

SP-012's `sourceLocation = satellite-clinic-ehr` is in `locationsIncluded` for the screen but the assessment feed from `satellite-clinic-ehr` is in `locationsOmitted`. This means we have the screen but cannot confirm absence of assessment.

---

## Expected Counts

### Eligibility

| State | Count | IDs |
|-------|-------|-----|
| ELIGIBLE | 13 | E01-E12 + E09b |
| NOT_ELIGIBLE | 3 | X01, X02, X03 |
| INDETERMINATE | 1 | U01 |
| INVALID | 0 | — |

Note: E09b is a separate screening event and is independently eligible. Total screens = 17.

### Maturity (eligible only)

| State | Count | IDs |
|-------|-------|-----|
| MATURE | 12 | E01-E09, E09b, E11, E12 |
| IMMATURE | 1 | E10 |

### Linkage (eligible + mature only)

| State | Count | IDs |
|-------|-------|-----|
| QUALIFYING_RECORD_LINKED_WITHIN_WINDOW | 4 | E01, E02, E03, E04 |
| QUALIFYING_RECORD_LINKED_OUTSIDE_WINDOW | 1 | E05 |
| NO_LINKED_RECORD_IN_AVAILABLE_DATA | 2 | E06, E07 |
| AMBIGUOUS_LINKAGE | 3 | E08, E09, E09b |
| PARTIAL_OR_NONQUALIFYING_RECORD | 1 | E11 |
| DATA_COVERAGE_UNKNOWN | 1 | E12 |

### Summary

- Eligible: 13 (12 from PROBLEM.md + E09b competing screen)
- Mature eligible: 12
- Within-window links: 4
- Outside-window links: 1
- Ambiguous: 3 (E08 + E09 + E09b)
- Immature: 1
- Partial: 1
- No link (complete feeds): 2
- Coverage unknown: 1
- Not eligible: 3
- Indeterminate: 1
- Observed-linkage proportion: 4/12 mature eligible = 0.333

### Discrepancy note vs PROBLEM.md Section 12

PROBLEM.md says "12 eligible" and "2 ambiguous". This fixture has 13 eligible and 3 ambiguous because E09 requires a **second competing screen** (E09b) to create the contested-assessment scenario. E09b is itself an eligible screening event that also resolves to AMBIGUOUS_LINKAGE. PROBLEM.md Section 12 acknowledges this: "Additional assessments/screens used to test E09 must be declared in a separate focused fixture, not silently added to the main count fixture." The E09b screen is explicitly declared here and its counts are tracked separately.

For the "main fixture" count matching PROBLEM.md: excluding E09b gives 12 eligible, 11 mature, 2 ambiguous (E08, E09). E09b is the declared "external competing event."

---

## Exclusion Reasoning

| Case | Reason |
|------|--------|
| X01 | `assessmentRequired = false`, `item9Value = 0` → explicit negative eligibility |
| X02 | `ageAtEvent = 16` < `populationMinAge = 18` → age scope exclusion |
| X03 | `setting = primary_care` ≠ `settingFilter = specialty_mental_health` → setting scope exclusion |
| U01 | `assessmentRequired = null` → missing eligibility field → INDETERMINATE |

---

## Boundary Test Scenarios (supplementary fixtures)

These are additional fixtures for SPEC-E, separate from the main count fixture.

### B01: Exactly at deadline boundary
Screen: Fri Aug 14, 10:00. Deadline: Tue Aug 18, 10:00 (inclusive, wall-clock).
Assessment performed: Tue Aug 18, 10:00:00 exactly → WITHIN window.

### B02: One second after deadline
Same screen as B01. Assessment performed: Tue Aug 18, 10:00:01 → OUTSIDE window.

### B03: Holiday in window
Screen: Thu Sep 3. Biz day 1 = Fri Sep 4. Biz day 2 = Tue Sep 8 (skip Sat, Sun, Labor Day Mon Sep 7).
Assessment on Tue Sep 8 → WITHIN window.

### B04: Duplicate import (idempotent)
Import `SRC-SCR-001` twice with identical fields → count unchanged, no error.

### B05: Conflicting duplicate
Import `SRC-SCR-001` with different `item9Value` → quarantine as INVALID.

### B06: Cross-patient explicit link
Assessment `asx-cross` has `triggeringScreenId = scr-E01` but `syntheticPatientId = SP-999` → reject link, validation failure.

### B07: Cross-org explicit link
Assessment in `org-other` has `triggeringScreenId = scr-E01` → reject, org mismatch.

### B08: Assessment reuse attempt
Two screens for same patient, both with `triggeringScreenId` pointing to same assessment → ambiguous, reuse conflict.

### B09: Late-arriving assessment
After initial run, add `asx-E06-late` for SP-006 within window. New run → E06 changes from `NO_LINKED_RECORD` to `QUALIFYING_RECORD_LINKED_WITHIN_WINDOW`. Previous run unchanged.
