---
"@voyantjs/bookings": minor
"@voyantjs/bookings-contracts": minor
"@voyantjs/octo": patch
---

Retire the default runtime Transactions bridge from Bookings and OCTO.
Bookings no longer exposes reserve-from-transaction schemas, service methods,
or admin routes, while OCTO now reads booking origin/provenance records instead
of the legacy booking-to-transaction detail table.
