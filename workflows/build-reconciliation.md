# Workflow: Build Reconciliation (Main 5-Hour Plan)

From PROBLEM.md Section 15. Time-boxed technical demonstration.

## Phases

### Phase 1: Schema and Fixtures (0:00-0:45) — schema-architect
- Define Prisma models for all domain objects (SourceArtifact with `hydraSourceId`)
- Set up org's HydraDB database, ingest P1-P6 publications and synthetic procedure
- Store `hydraSourceId` back into Prisma SourceArtifact records
- Create two ProtocolVersion + MeasureDefinition versions
- Hand-label E01-E12, X01-X03, U01 fixtures with expected outputs
- Write expected counts before any engine code
- **Gate: fixtures compile, HydraDB sources indexed, expected outputs documented**

### Phase 2: Reconciliation Engine (0:45-2:15) — reconciliation-engineer
- Implement 8-step reconciliation algorithm as pure TypeScript
- Business-day calendar with timezone, weekends, holidays
- Test hard cases first: ambiguity, competing screens, duplicates
- All known-answer fixtures must pass
- **Gate: all deterministic tests pass**

### Phase 3: Persistence and HydraDB (2:15-3:00) — schema-architect + reconciliation-engineer
- Wire seeded data into Prisma/PostgreSQL + HydraDB
- Source retrieval endpoint backed by HydraDB (exact passages, section locators)
- Source search endpoint using HydraDB hybrid search
- NestJS endpoint to trigger reconciliation run
- Store immutable ReconciliationRun with config hash and provenance
- **Gate: stored run retrievable with full provenance, source search working**

### Phase 4: Views (3:00-4:00) — frontend-builder
- Count table with all membership categories
- Event list with eligibility, linkage, review states
- Detail panel: rule version, source passage from HydraDB, candidates, reason codes
- Source search page using HydraDB hybrid search
- **Gate: inspectable outputs rendering correctly, source retrieval working**

### Phase 5: Review and Export (4:00-4:30) — frontend-builder
- Review annotation form (OPEN -> IN_REVIEW -> CLOSED_WITH_REASON)
- JSON/CSV export of decisions and memberships
- Verify closure cannot alter documentation or numerator
- **Gate: annotations persist, export works**

### Phase 6: Boundary Tests and Demo (4:30-5:00) — qa-tester
- Run boundary/adversarial tests
- Record scripted demo per PROBLEM.md Section 15
- Document test results and explicit limitations
- **Gate: test report complete**

## Cut order (if time runs short)
Keep: fixtures, reconciliation tests, one inspectable view.
Cut first: annotations, backend expansion, polish.
Never cut: correctness tests.
