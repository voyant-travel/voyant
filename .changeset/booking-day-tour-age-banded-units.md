---
"@voyantjs/bookings-ui": patch
---

Fix booking-create-dialog day-tour pricing-as-adult bug for products with age-banded unit codes (e.g. `child_0_5` / `child_6_12`) and for travelers added before the option-units queries resolve.

- `pickUnitForAge` now maps role hints (`infant` / `child` / `adult`) to a representative age and resolves against unit `[minAge, maxAge]` bands, instead of literal `INFANT` / `CHILD` code/name matching. Falls back to code/name matching only for legacy products with no min/max set.
- `TravelersSection` back-fills missing `roomUnitId`s once `roomUnits` arrives, honoring both DOB and the traveler's role hint via a new `matchUnitByRoleHint` helper. Fixes the race where billing-person auto-add (and the fallback Child/Infant buttons) ran before the stepper's option-units queries resolved, leaving `roomUnitId: null` permanently and collapsing the booking onto a single Adult-priced line.

Both fixes affect the live price preview in `BookingPreviewCard` as well as the submitted booking, since `redistributeByAge` drives both paths.
