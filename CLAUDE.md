# CLAUDE.md — AegisBrain: Screening-to-Assessment Reconciliation Demonstrator

## Product

AegisBrain is a screening-to-assessment measurement specification and synthetic
reconciliation demonstrator for behavioral-health quality improvement. It solves
one narrow problem: given a versioned configuration and synthetic records, show
which screening events qualify, which assessment records link under declared rules,
and which cases remain unmatched, ambiguous, or unmeasurable.

**It does NOT** administer instruments, score patients, classify risk, infer
urgency, make clinical decisions, process patient data, dispatch services, or
claim regulatory compliance.

See `PROBLEM.md` for the full problem statement, evidence, scope boundaries, and
acceptance criteria.

## Stack

- **Backend** — NestJS, TypeScript, Prisma, PostgreSQL (`apps/api/`)
- **Frontend** — Next.js App Router, React, Tailwind, shadcn/Radix (`apps/web/`)
- **Shared types** — `packages/shared/`
- **Knowledge store** — HydraDB (hybrid search + document retrieval, REST API)
- **Engine** — Pure TypeScript deterministic reconciliation (no LLM, no AI)
- **Tooling** — Turborepo, pnpm workspaces, Prisma, Jest/Vitest

## Architecture

```
Source artifacts (publications, synthetic procedures)
  -> HydraDB ingestion (per-org database, hybrid search)
  -> Prisma (relational: configs, events, runs, reviews)
  |
  v
Synthetic fixtures (screens, assessments, config versions, coverage)
  -> Reconciliation engine (pure deterministic function)
  -> Eligibility states, linkage states, membership, reason codes
  -> Persistence (ReconciliationRun, decisions)
  -> Count table + event list + detail panel
  |       |
  |       v
  |   Source passage retrieval from HydraDB (exact excerpts, provenance)
  v
  Review annotations (separate from computed results)
  -> JSON/CSV export
```

Multi-tenant: each Organization gets its own HydraDB database (`org_<uuid>`).

### HydraDB role

HydraDB is the **source-document store and retrieval layer**:

- **Ingestion**: Source artifacts (P1-P6 publications, synthetic procedures,
  protocol documents) are ingested into per-org HydraDB databases
- **Retrieval**: Detail panel fetches exact source passages, excerpts, and
  provenance via HydraDB hybrid search
- **Source linking**: SourceArtifact records in Prisma hold `hydraSourceId`
  pointing to the HydraDB document for full-text retrieval
- **Search**: QI analyst can search across ingested protocol documents and
  publications to locate relevant sections

HydraDB does NOT: select clinical policy, determine eligibility, calculate
measures, resolve ambiguous events, or generate clinical instructions.

## Core domain objects

| Object | Purpose |
|--------|---------|
| SourceArtifact | Publication or synthetic procedure with HydraDB source link |
| ProtocolVersion | Versioned org configuration with effective interval, roles, calendar |
| MeasureDefinition | Population filters, eligibility rule, assessment predicate, linkage rules |
| ScreeningEvent | Synthetic PHQ-9 screen with supplied eligibility flag |
| AssessmentEvent | Synthetic C-SSRS documentation record |
| CoverageManifest | Data completeness declaration per run |
| ReconciliationRun | Immutable run with config hash, decisions, membership |
| ReviewAction | Operational annotation that cannot mutate source or numerator |

## Agent usage protocol

1. **Read the agent definition** from `agents/<agent-name>.md`
2. **Use its content as the agent prompt** including body instructions
3. **Use the model specified** in the frontmatter (opus vs sonnet)
4. **Never improvise** — only use agents defined in `agents/`
5. **Gate-driven** — each workflow phase requires user approval before advancing

## Agents (6)

| Agent | Model | Role |
|-------|-------|------|
| researcher | opus | Problem analysis, evidence review, scope validation |
| reconciliation-engineer | opus | Reconciliation engine, business-day calendar, eligibility/linkage logic |
| schema-architect | opus | Prisma models, HydraDB ingestion, DTOs, data contracts, fixtures |
| frontend-builder | sonnet | Count table, event list, detail panel, review form |
| qa-tester | sonnet | Known-answer fixtures, boundary tests, adversarial cases |
| code-reviewer | sonnet | Convention compliance, deterministic correctness review |

## Rules (5, always active)

| Rule | Focus |
|------|-------|
| deterministic-correctness | No arbitrary selection, no silent defaults, null/zero/false distinct |
| synthetic-labeling | All data labeled synthetic, no clinical claims in UI |
| tenant-scoping | Org isolation, HydraDB database per tenant, scoped queries |
| hydradb-integration | API key guards, error handling, source linking |
| vertical-slices | Full-stack features in one pass |

## Workflows (2)

| Workflow | Purpose |
|----------|---------|
| build-reconciliation | Main 5-hour build plan from PROBLEM.md Section 15 |
| new-feature | Vertical slice pipeline for additions |

## Conventions

Follow `AGENTS.md` for all code. Key points:

- Full vertical slices: migration + service + DTO + API client + UI in one pass
- Tenant scoping: every query filters by `organizationId`
- HydraDB: one database per org (`org_<uuid>`), use existing `HydraDbService`
- Role checks in service layer, not guards
- `pnpm verify` before reporting done
- kebab-case files, PascalCase classes, camelCase members

## Scope guardrails

Before implementing any feature, check against PROBLEM.md Sections 5, 10, 13.

Critical constraints:
- Reconciliation is deterministic — no LLM, no probabilistic matching
- Null is distinct from zero, false, and absent
- Review closure cannot mutate source records or numerator
- No clinical urgency labels, risk colors, or escalation recommendations
- All procedures labeled SYNTHETIC
- Missing record is never proof of missed care
- HydraDB retrieves stored source passages — it does not select policy or resolve events

## Key paths

| What | Path |
|------|------|
| Problem definition | `PROBLEM.md` |
| API source | `apps/api/src/` |
| Web source | `apps/web/src/` |
| Prisma schema | `apps/api/prisma/schema.prisma` |
| Shared types | `packages/shared/` |
| HydraDB service | `apps/api/src/knowledge/hydra-db.service.ts` |
| Knowledge module | `apps/api/src/knowledge/` |
| Agent definitions | `agents/` |
| Workflows | `workflows/` |
| Rules | `rules/` |
| Specs | `specs/` |

## Verification

```bash
pnpm verify
```
