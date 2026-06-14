---
"@voyant-travel/accommodations": patch
---

Move shared place handling into Operations-owned places surfaces while
preserving existing `facilityId` database fields.

Remove direct cross-package database constraints from ground, distribution, and
accommodations into the legacy facilities/property tables; those references now
remain indexed loose ids for deployment-level linking.
