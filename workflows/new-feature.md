# Workflow: New Feature (Vertical Slice)

Build a complete feature from schema to UI in one pass.

## Phases

### Phase 0: Design (researcher)
- Analyze requirements against PROBLEM.md scope (Sections 5, 10, 13)
- Verify feature does not cross safety boundaries
- Propose data model and API shape
- **Gate: user approves design**

### Phase 1: Schema + Migration (schema-architect)
- Add Prisma model with tenant scoping
- Create migration with `prisma migrate dev`
- Regenerate Prisma client
- **Gate: migration applies cleanly**

### Phase 2: Backend (reconciliation-engineer)
- Service with `loadScoped` pattern
- Controller with auth guards
- DTOs with validation
- Module registration in `app.module.ts`
- **Gate: `tsc --noEmit` passes**

### Phase 3: Frontend (frontend-builder)
- API client functions
- Page components with no clinical claims
- **Gate: `pnpm verify` passes**

### Phase 4: Verification (qa-tester)
- Full `pnpm verify`
- Tenant scoping audit
- Deterministic correctness check
- **Gate: all checks pass**

### Phase 5: Review (code-reviewer)
- Correctness review (no arbitrary selection, no silent defaults)
- Synthetic labeling check
- Convention compliance
- **Gate: no CRITICAL or HIGH findings**
