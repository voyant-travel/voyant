---
"@voyantjs/bookings-react": minor
"@voyantjs/admin": minor
"@voyantjs/admin-app": minor
---

Package-deliver the booking-flow admin surfaces (packaged-admin final sweep)

- **bookings-react**: `createBookingsAdminExtension` now contributes the whole booking flow — three new route contributions alongside list/detail: `bookings-new` (`/bookings/new` owned-product picker that forwards into the unified journey; route-backed `booking.create` destination), `bookings-compose` (`/bookings/compose` legacy alias forwarding to the new `trip.create` destination), and `bookings-journey` (`/catalog/journey/$entityModule/$entityId`, the unified `BookingJourney` host with CRM-backed lead/traveler pickers, departure/units/voucher pickers, duplicate-departure warning, B2B default, and commit→`booking.detail` / cancel→`catalog.browse` navigation via semantic destinations). New exports: `bookingNewSearchSchema`, `bookingJourneySearchSchema` (+ param types) and the `BookingJourneyHost` admin module (`/admin/booking-journey-host`). Declares the `trip.create` destination key.
- **admin**: `useAdminNavigate` accepts an optional `AdminNavigateOptions` (`{ replace?: boolean }`) third argument, forwarded to the host-injected navigate so packaged redirect pages keep route-redirect history semantics.
- **admin-app**: the workspace shell's injected destination navigate maps `replace` onto the router's history-replace mode.
