---
"@voyant-travel/relationships": patch
---

Move the legacy custom-field EAV backfill into an automatic, data-safe package migration. The migration preserves values already written through the unified JSON path and refuses retirement when any legacy row cannot be accounted for.
