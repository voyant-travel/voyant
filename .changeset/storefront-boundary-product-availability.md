---
"@voyantjs/storefront": patch
---

Remove Storefront runtime dependencies on Product and Availability packages.
Public departure, pricing, itinerary, and booking-session reads now use
Storefront-owned SQL boundary queries, while Product and Availability remain
dev/test dependencies for integration coverage.
