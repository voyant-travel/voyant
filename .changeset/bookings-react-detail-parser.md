---
"@voyant-travel/bookings-react": patch
---

Preserve the hydrated `items`/`travelers`/`documents` collections on the
`useBooking` detail read.

The admin booking detail (`GET /v1/admin/bookings/:id`) hydrates its
bookings-owned child collections inline, but `getBookingQueryOptions` parsed the
response with the flat list record schema (`bookingRecordSchema`) — which
carries only an optional summary `items` and no `travelers`/`documents` — so Zod
silently stripped the newly-hydrated collections for `bookings-react` consumers.

Adds a `bookingDetailSchema` (record + full `items`, `travelers`, and
`documents`) and a dedicated `bookingDetailResponse` that the detail query now
uses. Travelers accept both the redacted and reveal shapes so an inline
`travelDetails` is preserved. `bookingSingleResponse` stays on the flat record
schema because it is shared by the mutation hooks (create/update/convert/
status/cancel), whose endpoints return a flat booking with no child collections.
