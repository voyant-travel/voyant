---
"@voyantjs/bookings-ui": patch
"@voyantjs/bookings": patch
---

Fix multi-option booking on option-scoped slots (issue #960). UI + server land together — neither half works on its own.

**UI (`@voyantjs/bookings-ui`)** — `OptionUnitsStepperSection` used to swap between data sources: when the slot's `option_id` was set, only that option's units showed, hiding every other option the product offered. A tour selling SGL/DBL/TWN/TPL on the same departure with `slot.option_id = popt_SGL` showed only "SGL · 2 left" next to a "Jun 18 · 45 left" departure badge; selling DBL required nulling out the slot's `option_id` in the DB.

The new behaviour merges the two sources: slot-bound `useSlotUnitAvailability` rows stay authoritative for the slot's own option (real-time `remaining` from active bookings), and product-level `option_units` fill in every other option the product offers. Product-level slots (`option_id = NULL`) and unloaded slot data fall back to product-level rows for everything. Exports `mergeStepperUnits` + `resolveSlotOptionId` as pure helpers.

**Server (`@voyantjs/bookings`)** — relaxed two hard guards that previously rejected multi-option booking on option-scoped slots:

- `getConvertProductData` dropped the "every requested line option must equal `selectedSlot.optionId`" reject. Each line's `optionId` is still validated to live on the product; the explicit caller-passed `data.optionId` mismatch reject stays.
- `convertProductToBooking` dropped the per-item `slot_option_mismatch` throw. The product mismatch throw stays (an item's `productId` still has to match the slot's product).

Slot pax capacity is still enforced server-side by `adjustSlotCapacity` — the wider stepper can't oversell the departure. Per-option-unit oversell of the non-slot-tracked options matches the existing behaviour for product-level slots and is called out in the existing capacity comment.

`reserveBooking` (offer-conversion path) keeps its `slot_option_mismatch` guard untouched — that flow is out of scope for this fix.
