---
"@voyant-travel/bookings": patch
"@voyant-travel/bookings-react": patch
---

Move booking requirements backend and React surfaces under the Bookings package
family. New imports are available from `@voyant-travel/bookings/requirements*` and
`@voyant-travel/bookings-react/requirements*`; the old standalone package names are
removed from v1. Existing
`/v1/booking-requirements/*` and `/v1/public/booking-requirements/*` API paths
continue to be mounted by the operator starter.
