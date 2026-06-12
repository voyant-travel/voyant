---
"@voyantjs/checkout": patch
---

The checkout collection POST routes (`/bookings/:bookingId/collection-plan`, `/bookings/:bookingId/initiate-collection`, `/collections/bootstrap`) now accept the standard `Idempotency-Key` header via the shared `idempotencyKey()` middleware — a duplicate request with the same key replays the stored response instead of re-initiating the collection (double invoices / payment sessions / notifications). The header stays optional, so existing clients are unaffected.
