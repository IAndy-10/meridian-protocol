# Rule: Synthetic Labeling (Always Active)

All data and procedures must be prominently labeled as synthetic.

## Requirements

### [CRITICAL] No clinical claims in UI
No clinical urgency labels, risk colors, escalation recommendations,
compliance claims, effectiveness assertions, or demand claims.

### [CRITICAL] Synthetic procedure label
All procedures displayed with:
"SYNTHETIC — NOT AN APPROVED CLINICAL PROCEDURE"

### [CRITICAL] Missing record interpretation
A missing record is never labeled as "missed care" or "assessment not performed".
Use: "No linked record in available data".

### [HIGH] Reporting convention not clinical
The two-business-day interval is a reporting convention. The UI must not
display it as a clinical deadline or safe waiting period.

### [HIGH] Count labels
Proportions are "observed-linkage measure, not clinical compliance".
Suppress proportion for zero denominators.
