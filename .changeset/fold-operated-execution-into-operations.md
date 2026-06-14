---
"@voyantjs/operations": minor
"@voyantjs/operations-react": minor
"@voyantjs/bookings-react": patch
"@voyantjs/finance-react": patch
"@voyantjs/inventory": patch
"@voyantjs/inventory-react": patch
"operator": patch
---

Move availability, allocation UI, resources, ground logistics, and places source
under Operations owner paths. The old operated-execution package names are
removed from the v1 workspace surface while first-party runtime, React, and
operator imports use `@voyantjs/operations` and `@voyantjs/operations-react`
surfaces.
