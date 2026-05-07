---
"@voyantjs/products": patch
---

Require `occupancyMin` (≥ 1) on `option_units` rows whose `unitType` is `room` or `vehicle`. Storefront pricing math multiplies `room.occupancy * room.quantity` for per-person totals, so leaving occupancy null silently caused the booking engine to under-count capacity-keyed prices (#481).

- `insertOptionUnitSchema` rejects room/vehicle units without a valid `occupancyMin`.
- `updateOptionUnitSchema` enforces `occupancyMax ≥ occupancyMin` when both are sent in a patch.
- `productsService.updateUnit` validates the merged record state (existing row + patch) before writing, so a patch that flips `unitType` to `room` or that nulls `occupancyMin` is rejected with a 400 even if the patch itself is sparse.
- New helper `validateMergedOptionUnit` exported for consumers building their own update flows.

No data-model change. Existing rows that already violate the rule are not migrated automatically; operators should audit `option_units WHERE unit_type IN ('room', 'vehicle') AND occupancy_min IS NULL` and fill in occupancy before deploying.
