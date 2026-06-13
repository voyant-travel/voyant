---
"@voyantjs/operations": minor
"@voyantjs/operations-react": minor
"@voyantjs/availability": patch
"@voyantjs/availability-react": patch
"@voyantjs/resources": patch
"@voyantjs/resources-react": patch
"@voyantjs/ground": patch
"@voyantjs/ground-react": patch
"@voyantjs/facilities": patch
"@voyantjs/facilities-react": patch
"@voyantjs/places": patch
"@voyantjs/places-react": patch
"@voyantjs/allocation-ui": patch
"@voyantjs/bookings-react": patch
"@voyantjs/finance-react": patch
"@voyantjs/inventory": patch
"@voyantjs/inventory-react": patch
"operator": patch
---

Move availability, allocation UI, resources, ground logistics, and places source
under Operations owner paths. Legacy package names now act as compatibility
facades while first-party runtime, React, and operator imports use
`@voyantjs/operations/*` and `@voyantjs/operations-react/*` surfaces.
