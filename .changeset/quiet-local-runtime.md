---
"@voyant-travel/admin": patch
"@voyant-travel/admin-host": patch
"@voyant-travel/bookings": patch
"@voyant-travel/finance": patch
"@voyant-travel/framework": patch
"@voyant-travel/operator-standard": patch
"@voyant-travel/realtime": patch
"@voyant-travel/realtime-react": patch
"@voyant-travel/runtime": patch
"@voyant-travel/storefront": patch
"@voyant-travel/storefront-react": patch
"@voyant-travel/vite-config": patch
---

Repair packaged consumer development and production startup, keep shared UI
contexts single-instanced under Vite, make unconfigured realtime quiet, and
restore narrow client-safe validation and Finance voucher setup exports. Resolve
legacy frontend imports through product-owned browser facades and allow clean CI
installs to fetch metadata for external dependencies.
