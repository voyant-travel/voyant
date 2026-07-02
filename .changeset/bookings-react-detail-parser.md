---
"@voyant-travel/bookings-react": patch
---

Preserve the hydrated `items`/`travelers`/`documents` collections on the
`useBooking` detail read.

The admin booking detail (`GET /v1/admin/bookings/:id`) hydrates its
bookings-owned child collections inline, but `bookingSingleResponse` parsed the
response with the flat list record schema (`bookingRecordSchema`) — which
carries only an optional summary `items` and no `travelers`/`documents` — so Zod
silently stripped the newly-hydrated collections for `bookings-react` consumers.

Adds a dedicated `bookingDetailSchema` (record + full `items`, `travelers`, and
`documents`) and points `bookingSingleResponse`/`useBooking` at it. Travelers
accept both the redacted and reveal shapes so an inline `travelDetails` is
preserved. The shared list parser is unchanged.
