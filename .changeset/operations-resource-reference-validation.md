---
"@voyant-travel/operations": patch
---

Validate operations resource local references and duplicate pool memberships with deterministic 404/409 API errors. Duplicate resource pool memberships are now deduplicated during migration before a unique index enforces the invariant.
