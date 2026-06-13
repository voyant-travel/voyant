---
"@voyantjs/sellability": patch
---

Remove Sellability resolve-time runtime dependencies on Product and
Availability schemas. Product option/unit and Availability slot data are now
read through SQL boundary queries, while Product and Availability remain
dev/test dependencies for integration coverage.
