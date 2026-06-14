---
"@voyantjs/bookings": minor
"@voyantjs/bookings-contracts": minor
"@voyantjs/octo": patch
"@voyantjs/transactions-contracts": patch
---

Retire the runtime Transactions packages before v1. The default Bookings/OCTO
bridge now reads booking origin/provenance records instead of the legacy
booking-to-transaction detail table, and the public `@voyantjs/transactions`
and `@voyantjs/transactions-react` workspaces have been removed. Legacy schema
consumers should migrate to `@voyantjs/transactions-contracts`.
