---
"@voyantjs/places": minor
"@voyantjs/places-react": minor
"@voyantjs/facilities": minor
"@voyantjs/facilities-react": minor
"@voyantjs/ground": patch
"@voyantjs/suppliers": patch
"@voyantjs/accommodations": patch
---

Introduce shared places packages and compatibility aliases while preserving existing facilities imports and `facilityId` fields.

Remove direct cross-package database constraints from ground, suppliers, and accommodations into the legacy facilities/property tables; those references now remain indexed loose ids for deployment-level linking.
