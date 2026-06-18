---
"@voyant-travel/bookings": minor
"@voyant-travel/bookings-contracts": minor
"@voyant-travel/framework": minor
"@voyant-travel/framework-migrations": patch
---

Adopt custom fields on `booking` — the first entity consumer of the `@voyant-travel/core/custom-fields` registry.

- A `custom_fields jsonb default '{}'` column on `bookings` (framework bundle migration `0001`).
- Booking create/update routes validate the `customFields` payload at the boundary against the deployment's injected registry (`validateBookingCustomFields`): unknown keys, missing required, and wrong types are rejected 400; only registry-approved values are persisted. Writes that carry `customFields` when the deployment declares none are rejected.
- The registry is injected through `BookingRouteRuntimeOptions.customFields` → `createBookingsHonoModule` → a new optional `FrameworkProviders.customFields` provider, which a deployment supplies (the operator wires its discovered `operatorCustomFields`).

Read paths return `custom_fields` as part of the booking row. Oracle-verified (`bundle + links == live schema`). Per-entity adoption continues with `person`/`product`; export/invoice/search consumption of `customFieldsVisibleIn` is a follow-up. See `docs/architecture/custom-fields.md`.
