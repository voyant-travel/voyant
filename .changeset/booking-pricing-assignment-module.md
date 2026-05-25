---
"@voyantjs/bookings": minor
"@voyantjs/bookings-ui": patch
---

Extract traveler→option-unit assignment into `@voyantjs/bookings/pricing-assignment` (Phase 2 of voyantjs/voyant#1267).

`pickUnitForAge`, `redistributeByAge`, `matchUnitByDob`, `matchUnitByRoleHint`, and `computeAgeYears` previously lived as private helpers inside `bookings-ui`'s `booking-create-dialog.tsx` and `travelers-section.tsx`. They now live in a pure, transport-agnostic module under `@voyantjs/bookings` so both the UI (price preview + submit) and server-side submit validation can share the same logic.

The new `derivePricingAssignment({ travelers, units, quantities })` is the canonical API — returns `{ assignedUnitIds, quantities }` with no mutation of input traveler rows. The older `redistributeByAge` shape is gone from the UI; consumers should call `derivePricingAssignment` directly.

`@voyantjs/bookings-ui` is unchanged behaviorally — every existing test still passes, and the imported helpers preserve the exact bug fixes shipped in 0.80.17 and 0.80.18 (issues #1234, #1239, #1262).
