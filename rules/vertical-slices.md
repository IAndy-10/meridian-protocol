# Rule: Vertical Slices (Always Active)

## Requirements

### [HIGH] One change, full stack
A feature that needs a backend endpoint and a frontend page MUST be
implemented as one change — migration, service, DTO, API client, and
component in a single pass.

### [HIGH] Shared types
Types and constants used by both apps belong in `packages/shared/`.
Never duplicate a type across `apps/api` and `apps/web`.

### [HIGH] Verify after every slice
Run `pnpm verify` (type-check + lint + tests) after completing a
vertical slice. Do not report done without a passing verify.

### [MEDIUM] Follow the reference
New modules MUST follow the `projects/` module structure exactly.
Do not invent new patterns.
