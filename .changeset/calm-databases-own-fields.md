---
"@voyant-travel/bookings": patch
"@voyant-travel/core": patch
"@voyant-travel/finance": patch
"@voyant-travel/relationships": patch
"@voyant-travel/relationships-contracts": patch
"@voyant-travel/relationships-react": patch
---

Resolve custom-field definitions exclusively from persisted Settings records.
Bookings and Relationships now share the package-owned database resolver, while
legacy TypeScript authoring helpers remain deprecated compatibility exports with
no runtime authority.
