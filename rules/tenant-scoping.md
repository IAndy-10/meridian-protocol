# Rule: Tenant Scoping (Always Active)

Every organization-scoped resource MUST be filtered by `organizationId`.

## Requirements

### [CRITICAL] Query filtering
Every `findFirst`, `findMany`, `findUnique`, `update`, `delete` on an
org-scoped model MUST include `organizationId` in the `where` clause.

```typescript
// Wrong — leaks cross-tenant data
const run = await this.prisma.reconciliationRun.findFirst({
  where: { id: runId },
});

// Correct
const run = await this.prisma.reconciliationRun.findFirst({
  where: { id: runId, organizationId },
});
```

### [CRITICAL] HydraDB database isolation
Each organization MUST use its own HydraDB database. Never query across
org databases.

```typescript
// Correct — org-scoped database name
const database = `org_${organizationId.replace(/-/g, '_')}`;
```

### [HIGH] 404 over 403
A valid id from another tenant MUST return 404, not 403. Do not confirm
the record exists to an unauthorized caller.

### [HIGH] Role checks in service layer
Role authorization lives in the service, not the controller or a guard.
The `organizationId` must be resolved against the caller first.
