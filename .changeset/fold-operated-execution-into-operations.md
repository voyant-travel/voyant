---
"@voyant-travel/operations": minor
"@voyant-travel/operations-react": minor
"@voyant-travel/bookings-react": patch
"@voyant-travel/finance-react": patch
"@voyant-travel/inventory": patch
"@voyant-travel/inventory-react": patch
---

Move availability, allocation UI, resources, ground logistics, and places source
under Operations owner paths. The old operated-execution package names are
removed from the v1 workspace surface while first-party runtime, React, and
operator imports use `@voyant-travel/operations` and `@voyant-travel/operations-react`
surfaces.
