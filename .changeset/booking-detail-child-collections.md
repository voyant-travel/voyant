---
"@voyant-travel/bookings": patch
---

Hydrate the bookings-owned child collections in the admin booking detail read.

`GET /v1/admin/bookings/{id}` now returns the booking together with its `items`,
`travelers`, and `documents` arrays instead of the flat booking row alone. These
records previously existed in the database but were only reachable through the
per-collection sibling endpoints, so clients that consumed the detail response
on its own saw the nested collections as `null`/absent. Traveler PII continues to
follow the same reveal/redaction gate as the standalone travelers read.

Finance-owned records (payments, invoices) are intentionally not inlined here to
respect the module boundary (bookings must not depend on finance); they remain
served by the finance booking-scoped admin routes and are composed at the
deployment boundary.
