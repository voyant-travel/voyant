---
"@voyantjs/pricing": patch
---

Remove the Pricing runtime dependency on Product and Availability packages.
Public pricing and availability snapshots now read Product option and
Availability slot data through SQL boundary queries, while Product and
Availability remain dev/test dependencies for integration coverage.
