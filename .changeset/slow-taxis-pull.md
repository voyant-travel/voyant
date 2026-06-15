---
"@voyant-travel/admin": patch
"@voyant-travel/admin-app": patch
"@voyant-travel/bookings-react": patch
"@voyant-travel/distribution-react": patch
"@voyant-travel/finance-react": patch
"@voyant-travel/inventory-react": patch
"@voyant-travel/operations-react": patch
"@voyant-travel/relationships-react": patch
"@voyant-travel/vite-config": patch
---

Improve operator bundle boundaries by adding route-local admin message provider support, exposing admin extension route helpers, keeping pending skeletons structural, and tightening Vite route ignores and vendor chunk splitting so heavy admin route dependencies stay out of the initial entry.
