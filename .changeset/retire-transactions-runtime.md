---
"@voyant-travel/bookings": minor
"@voyant-travel/bookings-contracts": minor
"@voyant-travel/octo": patch
---

Retire the runtime Transactions packages before v1. The default Bookings/OCTO
bridge now reads booking origin/provenance records instead of the legacy
booking-to-transaction detail table, and the public `@voyant-travel/transactions`
and `@voyant-travel/transactions-react` workspaces have been removed. The
legacy `@voyant-travel/transactions-contracts` workspace is removed as well;
use the owning domain contract/runtime package for replacement validation
schemas.
