# Rule: HydraDB Integration (Always Active)

HydraDB is the source-document store. It retrieves stored passages, not policy.

## Requirements

### [CRITICAL] No clinical authority from retrieval
HydraDB retrieves stored source passages and excerpts. It must NOT:
- Select clinical policy or determine eligibility
- Calculate measures or resolve ambiguous events
- Generate clinical instructions or recommendations
- Override deterministic reconciliation decisions

### [HIGH] API key protection
`HYDRA_DB_API_KEY` must be in `.env` only. Never commit, log, or expose
in client-side code.

### [HIGH] Error handling
All HydraDB calls must handle:
- Network timeouts (15s default)
- 4xx/5xx responses with meaningful error messages
- Database not found (auto-create on first use per org)
- Indexing-in-progress states

### [HIGH] Source linking
SourceArtifact records in Prisma hold `hydraSourceId` referencing the
HydraDB document. Ingestion writes both the Prisma record and the
HydraDB document. Retrieval uses `hydraSourceId` to fetch full text.

### [HIGH] Database naming
```typescript
// One database per org
const database = `org_${organizationId.replace(/-/g, '_')}`;
```

### [MEDIUM] Ingestion idempotency
Re-ingesting a source artifact with the same `contentHash` should not
create duplicate HydraDB documents. Check before ingesting.
