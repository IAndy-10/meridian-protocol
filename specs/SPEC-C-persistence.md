# SPEC-C: Persistence, HydraDB Integration, and API

**Phase:** 3 (2:15-3:00)
**Agent:** schema-architect + reconciliation-engineer
**Depends on:** SPEC-A schema, SPEC-B engine
**Produces:** Seeded database, HydraDB-backed source retrieval, NestJS endpoints, stored runs

---

## Objective

Wire the reconciliation engine into NestJS with Prisma persistence and HydraDB
source-document retrieval. Seed synthetic data into both stores and expose
endpoints to trigger runs, retrieve results, and search source documents.

## HydraDB Integration

Uses the existing `HydraDbService` and `KnowledgeModule` from
`app-starter/apps/api/src/knowledge/`.

### Source artifact flow

1. Seed script creates org's HydraDB database via `HydraDbService.ensureDatabase()`
2. Each SourceArtifact (publication, synthetic procedure) is ingested via
   `HydraDbService.ingestDocument()` with title and full text
3. `hydraSourceId` stored in Prisma SourceArtifact record
4. Detail panel retrieves exact passages via `HydraDbService.query()` using
   the source artifact's text and section locator

### Source search endpoint

QI analyst can search across all ingested source documents to locate relevant
sections, definitions, and evidence. Uses HydraDB hybrid search.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/organizations/:orgId/reconciliation/run` | Trigger a new reconciliation run |
| GET | `/organizations/:orgId/reconciliation/runs` | List runs with summary |
| GET | `/organizations/:orgId/reconciliation/runs/:runId` | Get full run with decisions |
| GET | `/organizations/:orgId/reconciliation/runs/:runId/export` | JSON/CSV export |
| GET | `/organizations/:orgId/sources` | List source artifacts |
| GET | `/organizations/:orgId/sources/:id` | Get source with HydraDB full text |
| POST | `/organizations/:orgId/sources/search` | Hybrid search across sources via HydraDB |

## Seed Data

- One fictional organization with HydraDB database (`org_<uuid>`)
- SourceArtifacts for P1-P6 and synthetic procedure (ingested into HydraDB)
- Two ProtocolVersions with MeasureDefinitions
- All fixture ScreeningEvents and AssessmentEvents
- CoverageManifest for the fixture dataset

## Immutability

ReconciliationRun records are append-only. A new run triggered after
late-arriving data creates a new record; previous runs remain queryable.

## Deliverables

1. NestJS reconciliation module registered in app.module.ts
2. Seed script populating Prisma + HydraDB with all fixture data
3. Source retrieval endpoint backed by HydraDB
4. Source search endpoint using HydraDB hybrid search
5. Stored run retrievable with full provenance
6. Config hash and engine version in every run
