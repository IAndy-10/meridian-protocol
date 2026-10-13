# SPEC-E: Boundary Tests and Demo

**Phase:** 6 (4:30-5:00)
**Agent:** qa-tester
**Depends on:** SPEC-A through SPEC-D
**Produces:** Test report, scripted demo, documented limitations

---

## Objective

Run boundary and adversarial tests, verify all acceptance criteria from
PROBLEM.md Section 11, and prepare a scripted demo.

## Acceptance Criteria Tests

1. Known-answer fixtures produce exact expected outputs
2. Null/zero/false/absent never collapse
3. Age/setting exclusions independently testable
4. Duplicate imports idempotent; conflicting duplicates quarantined
5. Explicit links cannot cross patient/organization boundaries
6. Multiple candidates produce ambiguity, not arbitrary selection
7. Partial documentation never silently becomes completed
8. Weekend, holiday, timezone, inclusive endpoint tests pass
9. Immature interval not counted as mature unmatched
10. Missing feeds visible; unknown coverage is never proof of absent care
11. Version boundary and overlapping policy tests pass
12. Review closure cannot mutate source, denominator, or numerator
13. Late-arriving record creates new run; previous inspectable
14. Excerpts match stored sources; synthetic labels present
15. All measures expose IDs, exclusions, unknowns, engine version, config hash
16. No clinical claims in UI

## Scripted Demo

1. Inspect synthetic rule and source provenance
2. Run fixture reconciliation
3. Show denominator breakdown (count table)
4. Inspect one valid within-window link (E01)
5. Inspect one ambiguous case (E08)
6. Inspect one coverage-unknown case (E12)
7. Close an operational review — verify metric unchanged
8. Show new run after adding late documentation
9. Display test results and explicit limitations

## Deliverables

1. All 16 acceptance criteria tested
2. Boundary test results documented
3. Scripted demo steps verified
4. Limitations explicitly recorded
