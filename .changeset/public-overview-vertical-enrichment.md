---
"@voyant-travel/bookings": minor
"@voyant-travel/bookings-contracts": minor
"@voyant-travel/accommodations": minor
"@voyant-travel/framework": minor
---

Add a vertical enrichment seam to the public guest-booking overview so
storefront "manage my booking" / confirmation surfaces can render
accommodation specifics from the public API alone (issue #2969).

Deployments can register a per-`booking_item_type` enricher via the new
`overviewItemEnrichers` option on the bookings route runtime. Each enricher
receives the overview items of its type and returns an opaque `details`
block that is attached to the matching overview item, keyed by booking item
id. Enrichment is best-effort — a failing enricher is skipped rather than
failing the guest-authorized overview.

`@voyant-travel/accommodations` ships the first enricher
(`enrichStayBookingOverviewItems`, exported from
`@voyant-travel/accommodations/booking-overview-enricher`), contributing
property, room type, rate plan, meal plan and per-night rate details. The
framework composition wires it to the `accommodation` item type.
