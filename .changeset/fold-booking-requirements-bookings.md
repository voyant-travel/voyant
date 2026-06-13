---
"@voyantjs/bookings": patch
"@voyantjs/bookings-react": patch
"@voyantjs/booking-requirements": patch
"@voyantjs/booking-requirements-react": patch
---

Move booking requirements backend and React surfaces under the Bookings package
family. New imports are available from `@voyantjs/bookings/requirements*` and
`@voyantjs/bookings-react/requirements*`; the old standalone package names
remain temporary compatibility shims. Existing
`/v1/booking-requirements/*` and `/v1/public/booking-requirements/*` API paths
continue to be mounted by the operator template.
