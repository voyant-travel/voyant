---
"@voyantjs/bookings": minor
"@voyantjs/bookings-react": minor
"@voyantjs/bookings-ui": minor
"@voyantjs/finance": minor
---

Separate inventory units (rooms, vehicles) from pricing tiers (Adult / Child / Infant) in the booking-create flow. RFC voyantjs/voyant#1267.

## What changed

### `@voyantjs/bookings` — new `./pricing-assignment` sub-path

Single source of truth for traveler→option-unit mapping, transport-agnostic. The booking-create dialog (preview + submit) is the only call site today; the server-side submit validation pathway is a follow-up — but the module is now placed where that wiring is straightforward:

```ts
import { resolveBookingDraft, resolveBookingExtraLines } from "@voyantjs/bookings/pricing-assignment"
```

`resolveBookingDraft` distinguishes **person-priced options** (excursions — line quantities derive from travelers) from **accommodation options** (rooms — quantities stay as the operator picked them). Returns `{ quantities, travelers, travelerIndexesByUnitId }` so submit can write `booking_item_travelers` linkage.

`resolveBookingExtraLines` normalizes per-person extras to charged traveler quantity and stamps `travelerIndexes` so each extra line gets linked to the travelers it applies to.

A new `roomUnitAssignmentSource: "auto" | "manual" | "none"` enum on the in-memory traveler tracks operator intent declaratively (was a one-shot `useRef` ratchet). `none` = explicit "No room" survives resolver re-runs; `auto` is re-derived; `manual` is preserved while the unit is still in the current option set.

### Wire format additions on `BookingCreateItemLineInput` / `BookingCreateExtraLineInput`

- `clientLineKey?: string | null` — stable client-side key the server stamps into `booking_items.metadata.bookingCreateLineKey` for post-insert lookup.
- `travelerIndexes?: number[] | null` — indexes (into the request's `travelers` array) the item/extra applies to. Server inserts one row in the existing `booking_item_travelers` join table per (item, traveler) pair.

`roomUnitId` on each traveler is unchanged on the wire — current dialogs keep working without modification.

### `@voyantjs/finance` — orchestrator links items to travelers

`POST /v1/bookings/create`: after travelers + items are inserted, the orchestrator looks up each item by its stamped `metadata.bookingCreateLineKey` and writes one `booking_item_travelers` row per requested traveler. Idempotent (dedupes by `(item_id, traveler_id)`), skips silently when the converter didn't produce an item for that key.

### `@voyantjs/bookings-ui` — resolver-driven dialog

- Dropped the locally-defined `pickUnitForAge` / `redistributeByAge` (moved to the assignment module in Phase 2).
- `displayQuantities` + submit both go through `resolveBookingDraft`. `displayExtraLines` (preview) + submit extras both go through `resolveBookingExtraLines`. No more drift.
- The submit pipeline sends `clientLineKey` + `travelerIndexes` on every item and per-person extra so the server can link them.
- `TravelerEntry` gains `roomUnitAssignmentSource`; category/Room/person-picker handlers set it explicitly (`manual` / `none` / `auto`).
- Dropped the one-shot hydration `useRef` from #1265 — the source enum + resolver re-derivation handle the race + "No room" disambiguation declaratively.

### Architecture doc

`docs/architecture/booking-journey-architecture.md` now codifies the invariant: traveler age/pricing band, sellable option unit, room/accommodation assignment, and explicit "no room" intent are separate draft concepts; preview totals and submit payloads must be derived from the same resolver; item/extra applicability is persisted through `booking_item_travelers`, not inferred from labels or counts. This prevents future regressions of the bug class behind #1234 / #1239 / #1262.

## Why this shape (vs. adding columns to `booking_travelers`)

The `booking_item_travelers` join table already existed for participant↔item linkage. Using it for unit assignment leverages a tool that was already in the codebase — no schema migration needed, and the model naturally handles cases where one traveler is linked to several items (room + per-pax extra + ...). Adding `pricing_unit_id` / `inventory_unit_id` columns directly to `booking_travelers` (the original plan in #1267 / earlier iterations of this PR) would have been a denormalization of what the join table already expresses.

## Backwards compatibility

- Existing wire-format clients that send `roomUnitId` on each traveler keep working — the server still accepts it (round-trips through, no behavioral change).
- New clients should send `pricingUnitId` semantics through `itemLines[].travelerIndexes` (the join-table model). The current dialog still uses `roomUnitId` internally; that's fine, the resolver bridges.
- No database migration. Pre-existing `booking_item_travelers` data is unaffected.
