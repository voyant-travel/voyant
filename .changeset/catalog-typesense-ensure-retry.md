---
"@voyant-travel/catalog": patch
---

Avoid redundant Typesense collection schema patches when the existing collection already matches the desired fields and metadata, and retry transient collection-update conflicts during ensureCollection.
