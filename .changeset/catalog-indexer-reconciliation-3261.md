---
"@voyant-travel/catalog": patch
---

Add a Node-only, engine-neutral index reconciliation API that requires a deployment-owned distributed write authority, accepts explicit obsolete-slice candidates, applies duplicate expected IDs with deterministic last-occurrence-wins semantics, and processes populated filesystem spool partitions one bucket at a time.
