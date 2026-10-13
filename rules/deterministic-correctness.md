# Rule: Deterministic Correctness (Always Active)

The reconciliation engine must be fully deterministic with no silent defaults.

## Requirements

### [CRITICAL] No arbitrary selection
Never choose the closest timestamp to resolve multiple candidate assessments
or competing screens. Multiple candidates produce AMBIGUOUS_LINKAGE.

### [CRITICAL] Null/zero/false distinction
Null is distinct from zero, false, and absent. Never collapse these:
- `null` = field not supplied
- `0` = explicit zero value
- `false` = explicit negative
- absent = field not present in input

### [CRITICAL] No assessment reuse
No single assessment record can satisfy two screening events under the
initial rule. Reuse conflicts produce ambiguous linkage.

### [CRITICAL] Immutable runs
A ReconciliationRun is immutable once created. Late-arriving records
create a new run; previous runs remain inspectable.

### [CRITICAL] Review cannot mutate source
Review closure (CLOSED_WITH_REASON) cannot change source records,
denominator membership, or assessment numerator.

### [HIGH] Idempotent duplicates, quarantined conflicts
Exact duplicate source records are idempotent. Conflicting records
sharing a source ID are quarantined with INVALID eligibility.

### [HIGH] Half-open config intervals
Configuration uses `[effectiveFrom, effectiveTo)`. Missing or overlapping
applicable versions block evaluation, never silently pick one.
