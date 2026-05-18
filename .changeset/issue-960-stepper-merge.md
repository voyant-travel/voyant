---
"@voyantjs/bookings-ui": patch
---

Fix `OptionUnitsStepperSection` hiding product options on option-scoped slots (issue #960).

The stepper used to swap between two data sources: when the slot's `option_id` was set, only that option's units were shown — even though the same product offered other bookable options (e.g. a tour selling SGL/DBL/TWN/TPL on the same departure). Operators saw a single "SGL · 2 left" row next to a "Jun 18 · 45 left" departure badge and couldn't sell anything but SGL without manually clearing the slot's `option_id` in the DB.

The new behaviour merges the two sources:

- Slot-bound `useSlotUnitAvailability` rows stay authoritative for the slot's own option (real-time `remaining` from active bookings).
- Product-level `option_units` fill in every *other* option the product offers, so the operator can pick DBL/TWN/TPL alongside the slot-tracked SGL.
- Product-level slots (`option_id = NULL`) and unloaded slot data fall back to the product-level rows for everything — same as before.

Capacity for the slot's option is still enforced server-side; the stepper only widens what the operator can compose.

Also exports `mergeStepperUnits` and `resolveSlotOptionId` as named helpers so the merge contract is unit-testable without a React render.
