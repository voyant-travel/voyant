---
"@voyant-travel/framework-migrations": patch
---

The import-baseline parity gate now checks only cutline entries the run is about to record: once an entry is in the ledger, applied post-cutline migrations may legitimately have reshaped or dropped its objects, and re-asserting the cutline-era schema on every run wedged partially-adopted databases forever.
