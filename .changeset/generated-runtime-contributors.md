---
"@voyant-travel/framework": patch
"@voyant-travel/action-ledger": patch
"@voyant-travel/auth": patch
"@voyant-travel/bookings": patch
"@voyant-travel/catalog": patch
"@voyant-travel/commerce": patch
"@voyant-travel/cruises": patch
"@voyant-travel/distribution": patch
"@voyant-travel/finance": patch
"@voyant-travel/flights": patch
"@voyant-travel/inventory": patch
"@voyant-travel/legal": patch
"@voyant-travel/mice": patch
"@voyant-travel/notifications": patch
"@voyant-travel/quotes": patch
"@voyant-travel/realtime": patch
"@voyant-travel/relationships": patch
"@voyant-travel/storage": patch
"@voyant-travel/storefront": patch
"@voyant-travel/trips": patch
"@voyant-travel/workflow-runs": patch
---

Declare package-owned runtime contributors in `voyant.package.v1` metadata and statically lower selected contributors into generated Node graph source. Node hosts now compose one generated contributor set from opaque host resources without enumerating first-party factories or package IDs.
