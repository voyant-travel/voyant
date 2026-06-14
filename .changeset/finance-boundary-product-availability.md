---
"@voyant-travel/finance": patch
---

Remove Finance runtime dependencies on Product and Availability schemas for tax
facts and profitability/allocation labels. Finance now uses reviewed SQL
boundary reads for those read-model lookups, keeping Product and Availability as
dev/test-only dependencies.
