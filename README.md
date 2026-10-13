# Meridian Protocol

Meridian is a multi-tenant reconciliation platform that traces whether positive mental health screenings receive timely follow-up assessments within two business days. It pairs a deterministic reconciliation engine with a knowledge layer that links every decision back to source evidence — publications, procedures, and policy documents — so QI analysts can see not just what happened, but why.

The entire process — from problem definition and deep research using Perplexity and Google's LLMs to frame the healthcare quality gap, through narrowing the scope, to building and iterating on the full-stack implementation — was completed within this hackathon.

## Inspiration

Healthcare quality improvement teams spend hours manually tracing whether positive mental health screenings receive timely follow-up assessments. The rules are buried in policy documents, the data lives in disconnected systems, and the audit trail is a spreadsheet. We wanted to build a system where the reconciliation logic is transparent, every decision traces back to the source evidence that defines it, and the knowledge corpus is explorable — not just searchable.

## What it does

Meridian answers one critical question: *Did each positive PHQ-9 screen get a follow-up C-SSRS assessment within two business days?*

It ingests screening events and assessment events, runs a deterministic reconciliation engine that classifies each screen by eligibility and linkage outcome, and presents results through both a data table and a visual pairing view with timeline visualization. A "Company Brain" module connects the reconciliation decisions back to source documents — publications, procedures, and policy memos — so analysts can see *why* a decision was made, not just *what* it was.

## How we built it

- **Research**: Perplexity and Google LLMs for deep research to frame the healthcare quality gap, define the problem scope, and narrow to a viable hackathon deliverable.
- **Backend**: NestJS + Prisma + PostgreSQL with a pure-function reconciliation engine that computes eligibility, business-day windows (accounting for weekends and holidays), and linkage state for every screen.
- **Frontend**: Next.js App Router + Tailwind + shadcn/Radix components, with a visual pairing view (screen-to-assessment card pairs with color-coded connectors), donut chart summary dashboard, and business-day timeline.
- **Knowledge layer**: HydraDB-backed document store with cross-collection unified search, provenance linking (decisions traced to source passages), graph context rendering showing how publications inform protocols, and a document upload UI.
- **Infrastructure**: Turborepo monorepo, pnpm workspaces, Docker (Postgres + Redis + Mailpit), with shared types across API and web to catch drift at compile time.

## Challenges we ran into

- **Field name drift** between the reconciliation engine and the frontend DTOs — the engine uses `matureEligible` and `absentLink` while the UI expected `mature` and `absent`. This produced a page full of zeros that looked like missing data but was actually a mapping bug.
- **Multi-tenant data isolation** made debugging harder: seed data lived in one organization while the logged-in user was navigating a different one, so everything appeared empty despite the database being full.
- **Business-day calculation** across weekends and holidays (e.g., a Friday screen before Labor Day) required careful timezone-aware logic to get the two-day window right.

## Accomplishments that we're proud of

- The reconciliation engine is a **pure deterministic function** — same inputs, same outputs, every time. No AI in the decision loop.
- Every decision can be **traced back to source evidence** via provenance linking, closing the loop between "what happened" and "why the rule says so."
- The visual pairing view makes screen-to-assessment matches **visible at a glance** — blue connectors for within-window, amber for late, dashed grey for missing, with expandable business-day timelines.
- Seven features shipped end-to-end (migration, service, DTO, API client, UI) in a single session.

## What we learned

- Building across the full stack in one pass catches integration bugs immediately — splitting backend and frontend into separate tasks is where field names drift apart.
- Multi-tenant systems need seed data that matches the actual user's org membership, or demo day is a blank screen.
- A "Company Brain" is fundamentally different from a search box — it's about showing connections between documents, not just listing results.

## What's next for Meridian

- **Live reconciliation streaming** — run the engine incrementally as new screens arrive instead of batch-triggering.
- **AI-assisted review** — use Claude to summarize ambiguous decisions and suggest resolution paths, while keeping the deterministic engine as the source of truth.
- **Multi-protocol support** — extend beyond PHQ-9/C-SSRS to arbitrary screen-assessment protocol pairs defined by each organization.
- **FHIR integration** — ingest screening and assessment events directly from EHR systems via FHIR R4 resources.
- **Audit workflow** — built-in review queues with role-based assignments, sign-off chains, and exportable audit packages for regulatory submissions.

## Tech Stack

TypeScript, Next.js, NestJS, React, Prisma, PostgreSQL, Redis, Tailwind CSS, shadcn/ui, Radix UI, Turborepo, pnpm, Docker, Node.js, Claude

## Getting Started

```bash
# Prerequisites: Docker, Node.js 22+, pnpm 8+

# Start infrastructure (Postgres, Redis, Mailpit)
./scripts/bootstrap.sh

# Install dependencies
pnpm install

# Set up environment files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# Run migrations and seed data
pnpm --filter @app-starter/api exec prisma migrate deploy
pnpm --filter @app-starter/api exec prisma generate
pnpm --filter @app-starter/api exec ts-node prisma/seed.ts
pnpm --filter @app-starter/api exec ts-node prisma/seed-aegis.ts

# Start dev servers
pnpm dev
```

|             |                        |
| ----------- | ---------------------- |
| Web         | http://localhost:3000   |
| API         | http://localhost:3001   |
| Mailpit     | http://localhost:8025   |

### Seed accounts

```
owner@example.com  / Password123!
member@example.com / Password123!
```

## License

[MIT](LICENSE)
