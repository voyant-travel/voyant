---
"@voyantjs/distribution": patch
---

Remove Distribution runtime dependencies on Product and Availability schemas.
Channel push now reads Product content and Availability slots through reviewed
SQL boundary queries, while Product and Availability remain dev/test-only
dependencies for integration coverage.
