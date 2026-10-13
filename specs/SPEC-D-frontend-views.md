# SPEC-D: Frontend Views

**Phase:** 4-5 (3:00-4:30)
**Agent:** frontend-builder
**Depends on:** SPEC-C API endpoints
**Produces:** Count table, event list, detail panel, review form, export

---

## Objective

Build the inspectable views for reconciliation results. The user should be
able to see every membership category, drill into individual decisions, and
annotate cases for operational review.

## Page: Reconciliation Dashboard (`/[org]/reconciliation`)

### Count Table
Display all membership categories from PROBLEM.md Section 7:
- Eligible count
- Indeterminate / Invalid / Excluded counts (with reasons)
- Confirmed within-window links
- Outside-window links
- Ambiguous cases
- Partial records
- Absent links
- Immature cases
- Coverage limitations

Optional proportion: `confirmed within-window / eligible mature`.
Suppress for zero denominators. Label as "conservative observed-linkage
measure, not clinical compliance".

### Event List
Table with columns: Patient ID, Screen Date, Eligibility, Linkage State,
Review Status, Actions.

Status badges by linkage state (neutral colors, no red/green clinical urgency):
- Within window: blue
- Outside window: amber
- Ambiguous: gray
- No link: gray
- Partial: gray
- Immature: light gray
- Coverage unknown: gray with icon

### Detail Panel (row expand or side panel)
- Rule version and effective dates
- Source passage retrieved from HydraDB via `hydraSourceId` (exact excerpt)
- Link to full source document with section locator
- Candidate assessments with timestamps
- Linked assessment details (if any)
- Reason codes
- Coverage manifest status
- "SYNTHETIC — NOT AN APPROVED CLINICAL PROCEDURE" label

### Source Search
- Search bar querying HydraDB hybrid search across all org source documents
- Results show document title, relevant passage, and section locator
- Click-through to full source artifact detail

### Review Annotation Form
- Status: OPEN -> IN_REVIEW -> CLOSED_WITH_REASON / REOPENED
- Reason text field
- Evidence reference field
- Previous actions shown as audit trail
- Cannot mutate source records, denominator, or numerator

### Export
- JSON and CSV download buttons
- Include all decision fields, membership, reason codes
- Include config hash, engine version, extraction cutoff

## Deliverables

1. Count table rendering all categories
2. Event list with status badges
3. Detail panel with provenance
4. Review form persisting annotations
5. Export functionality
6. No clinical claims or urgency labels anywhere
