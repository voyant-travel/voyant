---
"@voyant-travel/framework-migrations": patch
---

Execute a newly added migration source from the beginning when an existing
deployment has no ledger lineage or schema footprint for that source. Partial
or previously recorded sources remain protected by the import-baseline parity
gate.
