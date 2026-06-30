---
"@voyant-travel/catalog": patch
"@voyant-travel/finance": patch
---

Harden booking-confirmed side effects for at-least-once event delivery.

Catalog now exposes an idempotent booking snapshot graph capture helper for
event subscribers, so duplicate `booking.confirmed` deliveries observe existing
snapshot rows instead of surfacing unique constraint errors. Finance now treats
malformed payment-policy JSON as unset and falls back through the cascade,
preventing schedule generation from throwing on missing `deposit.kind`.
