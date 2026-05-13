---
"@voyantjs/bookings": minor
"@voyantjs/bookings-react": minor
"@voyantjs/bookings-ui": minor
"@voyantjs/ui": minor
---

Finish the bookings passenger-to-traveler rename across the React/UI layer and shadcn registry.

`@voyantjs/bookings-ui` now exposes `TravelersSection` and traveler-first section value/types. `@voyantjs/bookings-react` uses traveler hooks/query helpers over the traveler endpoints. The bookings activity enum now emits `traveler_update`; dev/operator/DMC migrations rename existing `passenger_update` activity rows.

The shadcn registry now publishes `voyant-bookings-travelers-section` and removes the stale passenger dialog/list/section registry artifacts.
