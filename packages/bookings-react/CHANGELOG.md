# @voyantjs/bookings-react

## 0.81.2

### Patch Changes

- @voyantjs/bookings@0.81.2
- @voyantjs/react@0.81.2

## 0.81.1

### Patch Changes

- @voyantjs/bookings@0.81.1
- @voyantjs/react@0.81.1

## 0.81.0

### Minor Changes

- f35e63c: Separate inventory units (rooms, vehicles) from pricing tiers (Adult / Child / Infant) in the booking-create flow. RFC voyantjs/voyant#1267.

  ## What changed

  ### `@voyantjs/bookings` — new `./pricing-assignment` sub-path

  Single source of truth for traveler→option-unit mapping, transport-agnostic. The booking-create dialog (preview + submit) is the only call site today; the server-side submit validation pathway is a follow-up — but the module is now placed where that wiring is straightforward:

  ```ts
  import {
    resolveBookingDraft,
    resolveBookingExtraLines,
  } from "@voyantjs/bookings/pricing-assignment";
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

### Patch Changes

- Updated dependencies [f35e63c]
  - @voyantjs/bookings@0.81.0
  - @voyantjs/react@0.81.0

## 0.80.18

### Patch Changes

- @voyantjs/bookings@0.80.18
- @voyantjs/react@0.80.18

## 0.80.17

### Patch Changes

- @voyantjs/bookings@0.80.17
- @voyantjs/react@0.80.17

## 0.80.16

### Patch Changes

- @voyantjs/bookings@0.80.16
- @voyantjs/react@0.80.16

## 0.80.15

### Patch Changes

- Updated dependencies [0d8d14e]
  - @voyantjs/bookings@0.80.15
  - @voyantjs/react@0.80.15

## 0.80.14

### Patch Changes

- @voyantjs/bookings@0.80.14
- @voyantjs/react@0.80.14

## 0.80.13

### Patch Changes

- @voyantjs/bookings@0.80.13
- @voyantjs/react@0.80.13

## 0.80.12

### Patch Changes

- @voyantjs/bookings@0.80.12
- @voyantjs/react@0.80.12

## 0.80.11

### Patch Changes

- @voyantjs/bookings@0.80.11
- @voyantjs/react@0.80.11

## 0.80.10

### Patch Changes

- @voyantjs/bookings@0.80.10
- @voyantjs/react@0.80.10

## 0.80.9

### Patch Changes

- Updated dependencies [37aa8b6]
  - @voyantjs/bookings@0.80.9
  - @voyantjs/react@0.80.9

## 0.80.8

### Patch Changes

- @voyantjs/bookings@0.80.8
- @voyantjs/react@0.80.8

## 0.80.7

### Patch Changes

- @voyantjs/bookings@0.80.7
- @voyantjs/react@0.80.7

## 0.80.6

### Patch Changes

- @voyantjs/bookings@0.80.6
- @voyantjs/react@0.80.6

## 0.80.5

### Patch Changes

- @voyantjs/bookings@0.80.5
- @voyantjs/react@0.80.5

## 0.80.4

### Patch Changes

- @voyantjs/bookings@0.80.4
- @voyantjs/react@0.80.4

## 0.80.3

### Patch Changes

- @voyantjs/bookings@0.80.3
- @voyantjs/react@0.80.3

## 0.80.2

### Patch Changes

- 9d6be13: Allow booking status overrides to suppress confirmed lifecycle events while preserving audit events.
- Updated dependencies [7a94871]
- Updated dependencies [9d6be13]
  - @voyantjs/bookings@0.80.2
  - @voyantjs/react@0.80.2

## 0.80.1

### Patch Changes

- @voyantjs/bookings@0.80.1
- @voyantjs/react@0.80.1

## 0.80.0

### Patch Changes

- @voyantjs/bookings@0.80.0
- @voyantjs/react@0.80.0

## 0.79.0

### Patch Changes

- @voyantjs/bookings@0.79.0
- @voyantjs/react@0.79.0

## 0.78.0

### Patch Changes

- @voyantjs/bookings@0.78.0
- @voyantjs/react@0.78.0

## 0.77.13

### Patch Changes

- @voyantjs/bookings@0.77.13
- @voyantjs/react@0.77.13

## 0.77.12

### Patch Changes

- @voyantjs/bookings@0.77.12
- @voyantjs/react@0.77.12

## 0.77.11

### Patch Changes

- @voyantjs/bookings@0.77.11
- @voyantjs/react@0.77.11

## 0.77.10

### Patch Changes

- @voyantjs/bookings@0.77.10
- @voyantjs/react@0.77.10

## 0.77.9

### Patch Changes

- @voyantjs/bookings@0.77.9
- @voyantjs/react@0.77.9

## 0.77.8

### Patch Changes

- @voyantjs/bookings@0.77.8
- @voyantjs/react@0.77.8

## 0.77.7

### Patch Changes

- @voyantjs/bookings@0.77.7
- @voyantjs/react@0.77.7

## 0.77.6

### Patch Changes

- @voyantjs/bookings@0.77.6
- @voyantjs/react@0.77.6

## 0.77.5

### Patch Changes

- @voyantjs/bookings@0.77.5
- @voyantjs/react@0.77.5

## 0.77.4

### Patch Changes

- @voyantjs/bookings@0.77.4
- @voyantjs/react@0.77.4

## 0.77.3

### Patch Changes

- @voyantjs/bookings@0.77.3
- @voyantjs/react@0.77.3

## 0.77.2

### Patch Changes

- @voyantjs/bookings@0.77.2
- @voyantjs/react@0.77.2

## 0.77.1

### Patch Changes

- Updated dependencies [574684d]
  - @voyantjs/bookings@0.77.1
  - @voyantjs/react@0.77.1

## 0.77.0

### Patch Changes

- @voyantjs/bookings@0.77.0
- @voyantjs/react@0.77.0

## 0.76.0

### Patch Changes

- @voyantjs/bookings@0.76.0
- @voyantjs/react@0.76.0

## 0.75.7

### Patch Changes

- @voyantjs/bookings@0.75.7
- @voyantjs/react@0.75.7

## 0.75.6

### Patch Changes

- @voyantjs/bookings@0.75.6
- @voyantjs/react@0.75.6

## 0.75.5

### Patch Changes

- @voyantjs/bookings@0.75.5
- @voyantjs/react@0.75.5

## 0.75.4

### Patch Changes

- @voyantjs/bookings@0.75.4
- @voyantjs/react@0.75.4

## 0.75.3

### Patch Changes

- @voyantjs/bookings@0.75.3
- @voyantjs/react@0.75.3

## 0.75.2

### Patch Changes

- @voyantjs/bookings@0.75.2
- @voyantjs/react@0.75.2

## 0.75.1

### Patch Changes

- @voyantjs/bookings@0.75.1
- @voyantjs/react@0.75.1

## 0.75.0

### Patch Changes

- Updated dependencies [1eab599]
  - @voyantjs/bookings@0.75.0
  - @voyantjs/react@0.75.0

## 0.74.2

### Patch Changes

- @voyantjs/bookings@0.74.2
- @voyantjs/react@0.74.2

## 0.74.1

### Patch Changes

- @voyantjs/bookings@0.74.1
- @voyantjs/react@0.74.1

## 0.74.0

### Patch Changes

- @voyantjs/bookings@0.74.0
- @voyantjs/react@0.74.0

## 0.73.1

### Patch Changes

- @voyantjs/bookings@0.73.1
- @voyantjs/react@0.73.1

## 0.73.0

### Patch Changes

- @voyantjs/bookings@0.73.0
- @voyantjs/react@0.73.0

## 0.72.0

### Patch Changes

- @voyantjs/bookings@0.72.0
- @voyantjs/react@0.72.0

## 0.71.0

### Patch Changes

- @voyantjs/bookings@0.71.0
- @voyantjs/react@0.71.0

## 0.70.0

### Patch Changes

- @voyantjs/bookings@0.70.0
- @voyantjs/react@0.70.0

## 0.69.1

### Patch Changes

- @voyantjs/bookings@0.69.1
- @voyantjs/react@0.69.1

## 0.69.0

### Patch Changes

- @voyantjs/bookings@0.69.0
- @voyantjs/react@0.69.0

## 0.68.0

### Patch Changes

- @voyantjs/bookings@0.68.0
- @voyantjs/react@0.68.0

## 0.67.0

### Patch Changes

- @voyantjs/bookings@0.67.0
- @voyantjs/react@0.67.0

## 0.66.6

### Patch Changes

- @voyantjs/bookings@0.66.6
- @voyantjs/react@0.66.6

## 0.66.5

### Patch Changes

- Updated dependencies [ee36ef5]
  - @voyantjs/bookings@0.66.5
  - @voyantjs/react@0.66.5

## 0.66.4

### Patch Changes

- Updated dependencies [83ff2de]
  - @voyantjs/bookings@0.66.4
  - @voyantjs/react@0.66.4

## 0.66.3

### Patch Changes

- @voyantjs/bookings@0.66.3
- @voyantjs/react@0.66.3

## 0.66.2

### Patch Changes

- @voyantjs/bookings@0.66.2
- @voyantjs/react@0.66.2

## 0.66.1

### Patch Changes

- @voyantjs/bookings@0.66.1
- @voyantjs/react@0.66.1

## 0.66.0

### Patch Changes

- @voyantjs/bookings@0.66.0
- @voyantjs/react@0.66.0

## 0.65.0

### Patch Changes

- @voyantjs/bookings@0.65.0
- @voyantjs/react@0.65.0

## 0.64.1

### Patch Changes

- @voyantjs/bookings@0.64.1
- @voyantjs/react@0.64.1

## 0.64.0

### Patch Changes

- Updated dependencies [6d0c8f3]
  - @voyantjs/bookings@0.64.0
  - @voyantjs/react@0.64.0

## 0.63.1

### Patch Changes

- @voyantjs/bookings@0.63.1
- @voyantjs/react@0.63.1

## 0.63.0

### Minor Changes

- 5bff9c3: Booking detail page becomes the canonical layout; booking items keep a catalog snapshot.

  `@voyantjs/bookings-ui`

  - `BookingDetailPage` now hosts the full operator-grade layout: action menu (edit / change status / cancel / delete), summary card (sell / cost+margin / dates / travelers / person / organization / created / updated), tabs (Overview, Travelers, Payments, optional Invoices, Suppliers, Documents, Activity, optional Ledger). New slot props `header`, `afterSummary`, `overviewStart`, `overviewEnd`, `travelersStart`, `financeStart`, `financeEnd`, `documents`, `activityEnd`, plus `invoicesTab` / `ledgerTab` (`{ label?, content }`) — templates compose template-owned cards via these slots. New callbacks `onPersonOpen`, `onOrganizationOpen`, `onRecordPayment` and a `hideBreadcrumb` flag for hosts that own their own breadcrumb chrome.
  - `BookingBillingContextCard` now hydrates from CRM (`usePerson` / `useOrganization`) when the booking's contact snapshot is empty, and renders its own `Edit` button wired to `BookingBillingDialog`.
  - `BookingItemList` shows `productNameSnapshot` as the row title with `optionNameSnapshot · unitNameSnapshot` as the subtitle, and `departureLabelSnapshot` wins over derived date formatting. The `Assigned travelers` panel was removed from the expanded row (the Travelers tab already covers it).
  - `SupplierStatusList` deduplicates visually identical rows (same `supplierServiceId` / `serviceName` / `status` / cost) and shows `× N` with a summed cost; edit pencil opens the head row.
  - Default tab label change: "Finance" → "Payments". New `tabInvoices` / `tabLedger` keys. Inline breadcrumb suppressible via `hideBreadcrumb`.
  - `BookingWorkspacePage` removed (no consumers; the canonical detail page now covers the same surface).
  - New: `BookingDetailTabSlot` type export.

  `@voyantjs/bookings`

  - `booking_items` gains catalog snapshot columns (all `text`, nullable, FK-less): `product_name_snapshot`, `option_name_snapshot`, `unit_name_snapshot`, `departure_label_snapshot`, and a decoupled `availability_slot_id` reference. Snapshots are written at create time so operators can always see "what the customer bought" — even on catalog-less deployments (OTA), and even if the catalog row is later deleted or renamed.
  - `convertProductToBooking` populates the snapshot columns and slot-id from `productsRef` / `productOptionsRef` / `optionUnitsRef` / `availabilitySlotsRef`. Caller-supplied `*Snapshot` / timing values win for OTA flows that bring their own data.
  - `createItem` / `updateItem` (template add-item path) resolve snapshots via a new internal helper. `updateItem` only refreshes snapshots when a foreign id changes — existing snapshots are the historical record and aren't overwritten on catalog renames.
  - `listItems` returns the snapshot fields with a plain select (no JOIN). `listBookingItemsForSummaries` (powers the bookings list) now COALESCEs the snapshot over the current catalog name.
  - `BOOKING_ITEM_MUTATION_FIELDS` allowlist extended for the new columns.

  `@voyantjs/bookings-react`

  - `BookingItemRecord` exposes `availabilitySlotId`, `productNameSnapshot`, `optionNameSnapshot`, `unitNameSnapshot`, `departureLabelSnapshot`.
  - `BookingsListFilters` adds `availabilitySlotId` so the list page can filter to a specific departure.

  Bookings list page (`BookingList` + `BookingListFiltersPopover`)

  - New **Lead** column (booking's `contactFirstName contactLastName`, falls back to `contactEmail`) and **Created** column (`createdAt`, sortable). `createdAt` joins the sortable-fields union (was previously omitted).
  - New **Departure** filter scoped to the selected product. Picker pulls slots via `useSlots({ productId, limit: 50 })` and labels them with `Intl.DateTimeFormat` in the slot's own timezone so the operator sees what the customer sees. Disabled until a product is picked; auto-clears when the product changes. New i18n keys: `columns.lead`, `columns.createdAt`, `filters.departureLabel` / `departure` / `departureEmpty` / `departureNeedsProduct` (EN + RO).
  - `bookingListQuerySchema` accepts an `availabilitySlotId` query param (server); `listBookings` ANDs it into the per-item EXISTS subquery via `booking_items.availability_slot_id` (relies on the snapshot column added by the same release).

  Templates that own a booking_items table must add the new columns: see `templates/operator/migrations/0026_booking_item_snapshots.sql` for the canonical migration shape (plus optional backfill migrations 0027 + 0028 to populate snapshots from the catalog and from `metadata.availabilitySlotId` for existing rows).

### Patch Changes

- Updated dependencies [5bff9c3]
  - @voyantjs/bookings@0.63.0
  - @voyantjs/react@0.63.0

## 0.62.3

### Patch Changes

- @voyantjs/bookings@0.62.3
- @voyantjs/react@0.62.3

## 0.62.2

### Patch Changes

- @voyantjs/bookings@0.62.2
- @voyantjs/react@0.62.2

## 0.62.1

### Patch Changes

- @voyantjs/bookings@0.62.1
- @voyantjs/react@0.62.1

## 0.62.0

### Patch Changes

- @voyantjs/bookings@0.62.0
- @voyantjs/react@0.62.0

## 0.61.0

### Patch Changes

- @voyantjs/bookings@0.61.0
- @voyantjs/react@0.61.0

## 0.60.0

### Patch Changes

- @voyantjs/bookings@0.60.0
- @voyantjs/react@0.60.0

## 0.59.0

### Patch Changes

- @voyantjs/bookings@0.59.0
- @voyantjs/react@0.59.0

## 0.58.0

### Patch Changes

- @voyantjs/bookings@0.58.0
- @voyantjs/react@0.58.0

## 0.57.0

### Patch Changes

- @voyantjs/bookings@0.57.0
- @voyantjs/react@0.57.0

## 0.56.0

### Patch Changes

- @voyantjs/bookings@0.56.0
- @voyantjs/react@0.56.0

## 0.55.1

### Patch Changes

- 819c847: Ship the composed trip admin workflow and booking extras integration.

  Admin surfaces now include trip list/detail/composer routes, catalog-backed
  trip assembly, aggregate checkout handoff, payment-link trip summaries, and
  trip-aware navigation. Booking journeys and regular booking creation can route
  operators into the composer when the customer is building a multi-component
  itinerary.

  Catalog booking draft shapes now expose richer add-on offers, and owned product
  booking handlers can price and commit selected extras. Product detail pages can
  manage extras, booking create can select extras, and finance booking creation
  persists selected extras as booking items so invoices and payment links include
  them.

  Checkout payment pages now render clearer trip summaries, flight booking UI
  supports the refined baggage/one-way behavior used by the composer, shared UI
  exports the date-time field, and i18n includes the new trip admin copy.

- Updated dependencies [819c847]
  - @voyantjs/bookings@0.55.1
  - @voyantjs/react@0.55.1

## 0.55.0

### Patch Changes

- @voyantjs/bookings@0.55.0
- @voyantjs/react@0.55.0

## 0.54.0

### Patch Changes

- 3117d27: Extract booking sell-side tax-preview helpers and route mounting into `@voyantjs/finance`.
  - @voyantjs/bookings@0.54.0
  - @voyantjs/react@0.54.0

## 0.53.2

### Patch Changes

- @voyantjs/bookings@0.53.2
- @voyantjs/react@0.53.2

## 0.53.1

### Patch Changes

- @voyantjs/bookings@0.53.1
- @voyantjs/react@0.53.1

## 0.53.0

### Patch Changes

- Updated dependencies [a315df6]
  - @voyantjs/bookings@0.53.0
  - @voyantjs/react@0.53.0

## 0.52.4

### Patch Changes

- Updated dependencies [5d3c119]
  - @voyantjs/bookings@0.52.4
  - @voyantjs/react@0.52.4

## 0.52.3

### Patch Changes

- Updated dependencies [9679a57]
  - @voyantjs/bookings@0.52.3
  - @voyantjs/react@0.52.3

## 0.52.2

### Patch Changes

- 3e09123: Booking create + detail flow overhaul.

  - Rename `RoomsStepperSection` → `OptionUnitsStepperSection` across `@voyantjs/bookings-ui` and the `@voyantjs/ui` registry. The old name implied hospitality-only usage; the same stepper now drives any product option (rooms, cabins, vehicles, seats). Re-export kept under the new name only — consumers must update imports.
  - Rebuild `BookingCreateDialog` around the new option-units stepper, person picker, travelers section, and price-breakdown card so room/cabin/seat selection, traveler capture, and price preview share state correctly. Travelers section gains contact-points support and consistent validation messages.
  - New `BookingBillingDialog` for editing the billing person/organization + billing address on an existing booking.
  - New `useBookingTaxPreview` hook + `booking.taxPreview` query option for previewing tax breakdowns on draft bookings before issuing an invoice. Exposes a new `bookingTaxPreviewSchema` from `@voyantjs/bookings-react/schemas`.
  - `useBookingCreateMutation`, `useBookingMutation`, and `useBookingStatusMutation` invalidate the new tax-preview and finance keys so price/invoice cards stay in sync after status transitions.
  - `@voyantjs/bookings` service: extend `validation` with the billing-update schema, wire `status-dispatch` to the new finance.issue payload, and add a tax-preview entrypoint consumed by the operator template.
  - i18n: new `bookings-ui` and `i18n/admin/bookings` strings for the billing dialog, tax preview, option-units copy, and status-change confirmations (EN + RO).

- Updated dependencies [3e09123]
  - @voyantjs/bookings@0.52.2
  - @voyantjs/react@0.52.2

## 0.52.1

### Patch Changes

- Updated dependencies [335d277]
  - @voyantjs/bookings@0.52.1
  - @voyantjs/react@0.52.1

## 0.52.0

### Patch Changes

- @voyantjs/bookings@0.52.0
- @voyantjs/react@0.52.0

## 0.51.1

### Patch Changes

- @voyantjs/bookings@0.51.1
- @voyantjs/react@0.51.1

## 0.51.0

### Patch Changes

- @voyantjs/bookings@0.51.0
- @voyantjs/react@0.51.0

## 0.50.8

### Patch Changes

- Updated dependencies [f35014f]
  - @voyantjs/bookings@0.50.8
  - @voyantjs/react@0.50.8

## 0.50.7

### Patch Changes

- @voyantjs/bookings@0.50.7
- @voyantjs/react@0.50.7

## 0.50.6

### Patch Changes

- c14f0a8: Fix the booking-create flow: scrollable dialog content with reachable actions, normalized product search, future departure lookup, shared-room clearing, explicit item lines, selectable traveler people including the payer, already-paid schedule rows, and booking-create naming throughout the API/registry surface.
- Updated dependencies [c14f0a8]
  - @voyantjs/bookings@0.50.6
  - @voyantjs/react@0.50.6

## 0.50.5

### Patch Changes

- @voyantjs/bookings@0.50.5
- @voyantjs/react@0.50.5

## 0.50.4

### Patch Changes

- @voyantjs/bookings@0.50.4
- @voyantjs/react@0.50.4

## 0.50.3

### Patch Changes

- @voyantjs/bookings@0.50.3
- @voyantjs/react@0.50.3

## 0.50.2

### Patch Changes

- @voyantjs/bookings@0.50.2
- @voyantjs/react@0.50.2

## 0.50.1

### Patch Changes

- @voyantjs/bookings@0.50.1
- @voyantjs/react@0.50.1

## 0.50.0

### Patch Changes

- @voyantjs/bookings@0.50.0
- @voyantjs/react@0.50.0

## 0.49.0

### Patch Changes

- @voyantjs/bookings@0.49.0
- @voyantjs/react@0.49.0

## 0.48.0

### Patch Changes

- @voyantjs/bookings@0.48.0
- @voyantjs/react@0.48.0

## 0.47.0

### Patch Changes

- @voyantjs/bookings@0.47.0
- @voyantjs/react@0.47.0

## 0.46.0

### Patch Changes

- @voyantjs/bookings@0.46.0
- @voyantjs/react@0.46.0

## 0.45.0

### Patch Changes

- @voyantjs/bookings@0.45.0
- @voyantjs/react@0.45.0

## 0.44.0

### Patch Changes

- @voyantjs/bookings@0.44.0
- @voyantjs/react@0.44.0

## 0.43.0

### Patch Changes

- @voyantjs/bookings@0.43.0
- @voyantjs/react@0.43.0

## 0.42.0

### Patch Changes

- @voyantjs/bookings@0.42.0
- @voyantjs/react@0.42.0

## 0.41.3

### Patch Changes

- @voyantjs/bookings@0.41.3
- @voyantjs/react@0.41.3

## 0.41.2

### Patch Changes

- @voyantjs/bookings@0.41.2
- @voyantjs/react@0.41.2

## 0.41.1

### Patch Changes

- @voyantjs/bookings@0.41.1
- @voyantjs/react@0.41.1

## 0.41.0

### Patch Changes

- @voyantjs/bookings@0.41.0
- @voyantjs/react@0.41.0

## 0.40.1

### Patch Changes

- @voyantjs/bookings@0.40.1
- @voyantjs/react@0.40.1

## 0.40.0

### Patch Changes

- @voyantjs/bookings@0.40.0
- @voyantjs/react@0.40.0

## 0.39.0

### Minor Changes

- f4235ea: Finish the bookings passenger-to-traveler rename across the React/UI layer and shadcn registry.

  `@voyantjs/bookings-ui` now exposes `TravelersSection` and traveler-first section value/types. `@voyantjs/bookings-react` uses traveler hooks/query helpers over the traveler endpoints. The bookings activity enum now emits `traveler_update`; dev/operator/DMC migrations rename existing `passenger_update` activity rows.

  The shadcn registry now publishes `voyant-bookings-travelers-section` and removes the stale passenger dialog/list/section registry artifacts.

### Patch Changes

- Updated dependencies [f4235ea]
  - @voyantjs/bookings@0.39.0
  - @voyantjs/react@0.39.0

## 0.38.2

### Patch Changes

- @voyantjs/bookings@0.38.2
- @voyantjs/react@0.38.2

## 0.38.1

### Patch Changes

- @voyantjs/bookings@0.38.1
- @voyantjs/react@0.38.1

## 0.38.0

### Patch Changes

- @voyantjs/bookings@0.38.0
- @voyantjs/react@0.38.0

## 0.37.1

### Patch Changes

- @voyantjs/bookings@0.37.1
- @voyantjs/react@0.37.1

## 0.37.0

### Minor Changes

- 4c93561: Add supplier, product category, option, person, and organization filters to the bookings list API and UI.
- dc29b79: Persist operator-confirmed booking totals from the create dialog and audit manual price overrides with a required reason.

### Patch Changes

- Updated dependencies [4c93561]
- Updated dependencies [dc29b79]
  - @voyantjs/bookings@0.37.0
  - @voyantjs/react@0.37.0

## 0.36.0

### Minor Changes

- 15e6953: Expose slot-scoped traveler sharing groups through bookings routes and React hooks, and wire traveler allocation metadata through travel-details validation.

### Patch Changes

- Updated dependencies [15e6953]
  - @voyantjs/bookings@0.36.0
  - @voyantjs/react@0.36.0

## 0.35.0

### Patch Changes

- @voyantjs/bookings@0.35.0
- @voyantjs/react@0.35.0

## 0.34.0

### Patch Changes

- @voyantjs/bookings@0.34.0
- @voyantjs/react@0.34.0

## 0.33.1

### Patch Changes

- 9bee9aa: Hydrate booking list item summaries with product names and prefer those names in the Bookings list "What booked" column.
- Updated dependencies [9bee9aa]
  - @voyantjs/bookings@0.33.1
  - @voyantjs/react@0.33.1

## 0.33.0

### Patch Changes

- @voyantjs/bookings@0.33.0
- @voyantjs/react@0.33.0

## 0.32.3

### Patch Changes

- @voyantjs/bookings@0.32.3
- @voyantjs/react@0.32.3

## 0.32.2

### Patch Changes

- @voyantjs/bookings@0.32.2
- @voyantjs/react@0.32.2

## 0.32.1

### Patch Changes

- @voyantjs/bookings@0.32.1
- @voyantjs/react@0.32.1

## 0.32.0

### Patch Changes

- Updated dependencies [6ea6ded]
  - @voyantjs/bookings@0.32.0
  - @voyantjs/react@0.32.0

## 0.31.4

### Patch Changes

- @voyantjs/bookings@0.31.4
- @voyantjs/react@0.31.4

## 0.31.3

### Patch Changes

- @voyantjs/bookings@0.31.3
- @voyantjs/react@0.31.3

## 0.31.2

### Patch Changes

- @voyantjs/bookings@0.31.2
- @voyantjs/react@0.31.2

## 0.31.1

### Patch Changes

- @voyantjs/bookings@0.31.1
- @voyantjs/react@0.31.1

## 0.31.0

### Patch Changes

- @voyantjs/bookings@0.31.0
- @voyantjs/react@0.31.0

## 0.30.7

### Patch Changes

- @voyantjs/bookings@0.30.7
- @voyantjs/react@0.30.7

## 0.30.6

### Patch Changes

- @voyantjs/bookings@0.30.6
- @voyantjs/react@0.30.6

## 0.30.5

### Patch Changes

- @voyantjs/bookings@0.30.5
- @voyantjs/react@0.30.5

## 0.30.4

### Patch Changes

- @voyantjs/bookings@0.30.4
- @voyantjs/react@0.30.4

## 0.30.3

### Patch Changes

- @voyantjs/bookings@0.30.3
- @voyantjs/react@0.30.3

## 0.30.2

### Patch Changes

- @voyantjs/bookings@0.30.2
- @voyantjs/react@0.30.2

## 0.30.1

### Patch Changes

- @voyantjs/bookings@0.30.1
- @voyantjs/react@0.30.1

## 0.30.0

### Patch Changes

- @voyantjs/bookings@0.30.0
- @voyantjs/react@0.30.0

## 0.29.0

### Patch Changes

- Updated dependencies [3420711]
  - @voyantjs/bookings@0.29.0
  - @voyantjs/react@0.29.0

## 0.28.3

### Patch Changes

- @voyantjs/bookings@0.28.3
- @voyantjs/react@0.28.3

## 0.28.2

### Patch Changes

- @voyantjs/bookings@0.28.2
- @voyantjs/react@0.28.2

## 0.28.1

### Patch Changes

- @voyantjs/bookings@0.28.1
- @voyantjs/react@0.28.1

## 0.28.0

### Patch Changes

- @voyantjs/bookings@0.28.0
- @voyantjs/react@0.28.0

## 0.27.0

### Patch Changes

- @voyantjs/bookings@0.27.0
- @voyantjs/react@0.27.0

## 0.26.9

### Patch Changes

- @voyantjs/bookings@0.26.9
- @voyantjs/react@0.26.9

## 0.26.8

### Patch Changes

- @voyantjs/bookings@0.26.8
- @voyantjs/react@0.26.8

## 0.26.7

### Patch Changes

- @voyantjs/bookings@0.26.7
- @voyantjs/react@0.26.7

## 0.26.6

### Patch Changes

- Updated dependencies [571e340]
  - @voyantjs/bookings@0.26.6
  - @voyantjs/react@0.26.6

## 0.26.5

### Patch Changes

- @voyantjs/bookings@0.26.5
- @voyantjs/react@0.26.5

## 0.26.4

### Patch Changes

- @voyantjs/bookings@0.26.4
- @voyantjs/react@0.26.4

## 0.26.3

### Patch Changes

- @voyantjs/bookings@0.26.3
- @voyantjs/react@0.26.3

## 0.26.2

### Patch Changes

- @voyantjs/bookings@0.26.2
- @voyantjs/react@0.26.2

## 0.26.1

### Patch Changes

- c0507a6: Move toxic PII to `crm.people` and add structured `person_documents` (closes #440 and #443).

  `user_profiles` is no longer the home for encrypted PII. The four free-text slots (accessibility / dietary / loyalty / insurance) move to `crm.people` so operator-managed humans without auth accounts can carry them, and identity documents graduate to a structured `person_documents` table with type / expiry / issuing authority / attachment + a partial unique index pinning a single primary doc per type per person.

  Booking travelers now snapshot dietary, accessibility, and the primary passport from the linked person record at create time (snapshot-on-create, explicit input always wins) via a new `POST /v1/admin/bookings/:id/travelers/with-travel-details` route. Templates wire the snapshot via `createBookingsHonoModule({ resolveTravelSnapshot })` delegating to `crmService.loadPersonTravelSnapshot` — bookings stays free of any direct CRM dependency.

  Customer portal exposes plaintext `accessibility/dietary/loyalty/insurance` on `/me` plus full CRUD over `/me/documents`. CRM admin gains server-side encrypt/decrypt endpoints (`travel-snapshot`, `profile-pii`, `*/from-plaintext`) so the operator booking-traveler dialog can pre-fill from profile and push diverging values back without the browser holding KMS material. The dialog itself now ships a "Travel details" section with passport / dietary / accessibility fields, plus "Pre-fill from profile" and "Save to profile" affordances when a CRM person is linked.

  Breaking changes (intentionally landed pre-1.0):

  - `user_profiles.documentsEncrypted/accessibilityEncrypted/dietaryEncrypted/loyaltyEncrypted/insuranceEncrypted` columns are removed. Migration ships `templates/operator/migrations/0024_people_pii_documents.sql`.
  - `customerPortalProfileSchema.documents` (array) replaced with separate `accessibility/dietary/loyalty/insurance` plaintext string fields. Document CRUD lives at `/v1/public/customer-portal/me/documents`.
  - `bookingsHonoModule` and `crmHonoModule` are still exported but the env-driven default factory `createBookingsHonoModule()` / `createCrmHonoModule()` is the new recommended entry point.

- Updated dependencies [c0507a6]
  - @voyantjs/bookings@0.26.1
  - @voyantjs/react@0.26.1

## 0.26.0

### Patch Changes

- @voyantjs/bookings@0.26.0
- @voyantjs/react@0.26.0

## 0.25.0

### Patch Changes

- @voyantjs/bookings@0.25.0
- @voyantjs/react@0.25.0

## 0.24.3

### Patch Changes

- @voyantjs/bookings@0.24.3
- @voyantjs/react@0.24.3

## 0.24.2

### Patch Changes

- @voyantjs/bookings@0.24.2
- @voyantjs/react@0.24.2

## 0.24.1

### Patch Changes

- @voyantjs/bookings@0.24.1
- @voyantjs/react@0.24.1

## 0.24.0

### Patch Changes

- @voyantjs/bookings@0.24.0
- @voyantjs/react@0.24.0

## 0.23.0

### Patch Changes

- @voyantjs/bookings@0.23.0
- @voyantjs/react@0.23.0

## 0.22.0

### Patch Changes

- @voyantjs/bookings@0.22.0
- @voyantjs/react@0.22.0

## 0.21.1

### Patch Changes

- @voyantjs/bookings@0.21.1
- @voyantjs/react@0.21.1

## 0.21.0

### Minor Changes

- 6427bad: Release the booking journey architecture train.

  This adds booking hold policy support, richer traveler and booking journey flows, operator tax policy configuration, finance billing and tax policy APIs, notification reminder target and delivery tooling, and the template/runtime wiring needed for the operator storefront checkout flow.

### Patch Changes

- Updated dependencies [6427bad]
  - @voyantjs/bookings@0.21.0
  - @voyantjs/react@0.21.0

## 0.20.0

### Patch Changes

- @voyantjs/bookings@0.20.0
- @voyantjs/react@0.20.0

## 0.19.0

### Patch Changes

- @voyantjs/bookings@0.19.0
- @voyantjs/react@0.19.0

## 0.18.0

### Patch Changes

- Updated dependencies [8932f60]
  - @voyantjs/bookings@0.18.0
  - @voyantjs/react@0.18.0

## 0.17.0

### Patch Changes

- 66d722d: `CreateBookingItemInput` and `UpdateBookingItemInput` are now derived from the server's `insertBookingItemSchema` / `updateBookingItemSchema` via `z.input<typeof …>` — eliminating drift between the client type and the server's accepted shape. Picks up 7 fields the hand-rolled interface had missed: `productId`, `optionId`, `optionUnitId`, `pricingCategoryId`, `sourceSnapshotId`, `sourceOfferId`, `metadata`. Consumers building "custom itinerary" admin UIs can now pass `productId` / `optionId` to `useBookingItemMutation().create.mutateAsync(...)` without a type assertion.
- Updated dependencies [66d722d]
  - @voyantjs/bookings@0.17.0
  - @voyantjs/react@0.17.0

## 0.16.0

### Patch Changes

- @voyantjs/bookings@0.16.0
- @voyantjs/react@0.16.0

## 0.15.0

### Patch Changes

- @voyantjs/bookings@0.15.0
- @voyantjs/react@0.15.0

## 0.14.0

### Patch Changes

- @voyantjs/bookings@0.14.0
- @voyantjs/react@0.14.0

## 0.13.0

### Patch Changes

- Updated dependencies [7dfbc05]
- Updated dependencies [15dda79]
  - @voyantjs/bookings@0.13.0
  - @voyantjs/react@0.13.0

## 0.12.0

### Patch Changes

- Updated dependencies [944d244]
- Updated dependencies [cc561ce]
  - @voyantjs/bookings@0.12.0
  - @voyantjs/react@0.12.0

## 0.11.0

### Minor Changes

- fe905b0: **BREAKING:** privatize the Booking state machine; add Start, Complete, and Override verbs.

  The transition graph (`BOOKING_TRANSITIONS`, `canTransitionBooking`, `transitionBooking`, `BookingStatusPatch`, `BookingTransitionError`) is no longer part of the `@voyantjs/bookings` public surface. The lifecycle laws live behind the service-verb seam — callers cross it via named verbs in the ubiquitous language. `BookingStatus` stays exported (it's data).

  **HTTP — verb routes replace the generic status PATCH:**

  - `PATCH /:id/status` is **removed**.
  - `POST /:id/start` — confirmed → in_progress (new). Emits `booking.started`.
  - `POST /:id/complete` — in_progress → completed (new). Emits `booking.completed`. Cascades confirmed allocations + items to `fulfilled`.
  - `POST /:id/override-status` — admin override that bypasses the transition graph (new). Updates the Booking row only; does **not** cascade. Requires a non-empty `reason`. Emits `booking.status_overridden` as a privileged audit signal distinct from the normal lifecycle events.

  `POST /:id/confirm`, `/:id/cancel`, `/:id/expire`, `/:id/extend-hold` are unchanged.

  **Service:**

  - `bookingsService.updateBookingStatus(...)` is **removed**.
  - `bookingsService.startBooking(...)`, `.completeBooking(...)`, `.overrideBookingStatus(...)` are added.
  - `updateBookingStatusSchema` is removed; `startBookingSchema`, `completeBookingSchema`, `overrideBookingStatusSchema` are added.
  - Activity-type enum gains `booking_started`, `booking_completed`, `status_overridden`. Run `drizzle-kit push` to sync.

  **React (`@voyantjs/bookings-react`):**

  `useBookingStatusMutation` / `useBookingStatusByIdMutation` now require `currentStatus` in their input. The hook dispatches client-side to the right verb endpoint; non-adjacent jumps fall through to `/override-status`, using the operator's note as the reason. The `<StatusChangeDialog>` UX is unchanged — pass the booking's current status from props.

  **Domain language:** `Start`, `Complete`, and `Override` are added to UBIQUITOUS_LANGUAGE.md as Booking-scoped lifecycle verbs.

  **Migration:**

  - Remove imports of `BOOKING_TRANSITIONS` / `canTransitionBooking` / `transitionBooking` / `BookingTransitionError` / `BookingStatusPatch` from `@voyantjs/bookings` — call the service verbs instead. Internal callers (within this monorepo) had none.
  - Replace `PATCH /v1/bookings/:id/status` calls with the matching verb endpoint, or `/override-status` with a `reason`.
  - Update calls to the React status hooks to pass `currentStatus`.

### Patch Changes

- Updated dependencies [fe905b0]
  - @voyantjs/bookings@0.11.0
  - @voyantjs/react@0.11.0

## 0.10.0

### Patch Changes

- Updated dependencies [29a581a]
- Updated dependencies [29a581a]
- Updated dependencies [29a581a]
- Updated dependencies [29a581a]
- Updated dependencies [29a581a]
- Updated dependencies [29a581a]
- Updated dependencies [29a581a]
- Updated dependencies [29a581a]
  - @voyantjs/bookings@0.10.0
  - @voyantjs/react@0.10.0

## 0.9.0

### Minor Changes

- 3a6a4db: **Rename**: `QuickBookDialog` → `BookingCreateDialog` across the registry, operator, and dmc templates. The dialog was originally a lightweight create alternative to a flat-form CTA, but since the composition slice landed (#264 — product / departure / rooms / person / shared-room / passengers / price breakdown / voucher / payment schedule all wired through the atomic `/quick-create` endpoint) it IS the booking-create workflow. Keeping "Quick Book" in the name actively misled operators.

  **Bumped via this changeset but not code-changed on npm**: this package is on the fixed release train with everything else, so it ships the version bump alongside the others. The actual rename lives in `@voyantjs/ui` (registry, in the ignore list), `@voyantjs/i18n` (private), and the templates — consumers see the effect via fresh starter archives (`voyant new`) or the next `shadcn add`.

  Breaking for consumers who copied the registry component earlier:

  - `QuickBookDialog` → `BookingCreateDialog` (symbol)
  - `quick-book-dialog.tsx` → `booking-create-dialog.tsx` (file path)
  - Registry entry `voyant-bookings-quick-book-dialog` → `voyant-bookings-booking-create-dialog`
  - i18n namespace `bookings.quickBook` → `bookings.create`; `bookings.list.quickBook` removed (booking list now has a single "+ New Booking" CTA)
  - `BookingDialog` now declares `voyant-bookings-booking-create-dialog` as a registry dep, so `shadcn add voyant-bookings-booking-dialog` pulls both in automatically

  Consumers who migrated the files locally can drop the old `QuickBookDialog` copy and regenerate via the registry, or run the equivalent of `grep -rl 'QuickBookDialog\|quick-book-dialog\|bookings\\.quickBook' | xargs sed -i ''` on their app.

### Patch Changes

- @voyantjs/bookings@0.9.0
- @voyantjs/react@0.9.0

## 0.8.0

### Patch Changes

- @voyantjs/bookings@0.8.0
- @voyantjs/react@0.8.0

## 0.7.0

### Minor Changes

- 96612b3: Bookings-create composition surface (#223) and vouchers-as-first-class (#227) — the packages on the release train all move together, so this covers the batch.

  **Atomic booking create (#263, #264, #265, #266)**

  - `POST /v1/admin/bookings/quick-create` — one-shot endpoint that converts a product, inserts travelers + payment schedules, redeems a voucher, and creates/joins a `booking_group` inside a single DB transaction. `quickCreateBooking(db, input, { userId, runtime })` service in `@voyantjs/finance`; `useBookingQuickCreateMutation` in `@voyantjs/bookings-react`.
  - `POST /v1/admin/bookings/dual-create` — partaj flow: two bookings + one shared-room group, also atomic. `dualCreateBooking` service, `useBookingDualCreateMutation` hook.
  - `booking.quick-created` and `booking.dual-created` events emitted post-commit when a runtime eventBus is wired.
  - `QuickBookDialog` now mounts all nine picker sections (product, departure, rooms, person, shared-room, passengers, price breakdown, voucher, payment schedule) and submits via quick-create. Post-create "Confirm & notify traveler" toggle uses the new `useBookingStatusByIdMutation` to transition the fresh booking to `confirmed` — which (when `autoConfirmAndDispatch` is on) fires the doc bundle + traveler email through the existing `booking.confirmed` subscriber.
  - Bookings fix: `productDaysRef` / `getConvertProductData` now join through `product_itineraries` to match the real products schema; the existing `POST /v1/bookings/from-product` convert path works again.

  **Vouchers as first-class financial instruments (#262, #267)**

  - One-shot data migration: `migrateVouchersFromPaymentInstruments(db, opts)` in `@voyantjs/finance` (CLI wrapper `pnpm -F @voyantjs/finance migrate:vouchers`, `--dry-run` supported). Idempotent; pulls code, currency, amount, expiry from legacy JSONB metadata into the new `vouchers` table.
  - `vouchers.validFrom` (start-of-validity, maps to OpenTravel `Finance.Voucher.effectiveDate`) and `vouchers.seriesCode` (batch/campaign id, maps to `Finance.Voucher.seriesCode`) columns added. Redeem guard returns `voucher_not_started` when now < validFrom; the public `validateVoucher` `not_started` branch is now reachable. `seriesCode` exposed as a list filter. Migration pulls both from legacy metadata (honouring OpenTravel's `effectiveDate` alias).

### Patch Changes

- Updated dependencies [96612b3]
  - @voyantjs/bookings@0.7.0
  - @voyantjs/react@0.7.0

## 0.6.9

### Patch Changes

- 7619ef0: Continue the traveler-first booking contract cleanup across the published booking surfaces while preserving compatibility aliases.

  - `@voyantjs/bookings`: add traveler-first public aliases for booking travel details, group traveler routes, public booking-session traveler input, and traveler-facing validation/error wording while keeping legacy participant/passenger compatibility routes and schemas.
  - `@voyantjs/bookings-react`: make traveler hooks, query options, schemas, and exports the primary surface again; keep passenger/item-participant names as compatibility aliases instead of separate primaries.
  - `@voyantjs/customer-portal` and `@voyantjs/customer-portal-react`: move booking import schemas, operations, and exports to traveler-first names while preserving legacy participant aliases and routes.
  - `@voyantjs/transactions`: expose traveler-first request/response aliases and traveler route aliases for offer/order traveler and item-traveler flows while preserving legacy participant compatibility endpoints.
  - `@voyantjs/auth-react`: add exported query keys, query options, and schemas for current workspace, organization members, and organization invitations so app surfaces can consume the auth workspace contract directly.
  - `@voyantjs/products` and `@voyantjs/products-react`: tighten the itinerary-facing public surface and query/schema exports used by the shared product itinerary UI.
  - `@voyantjs/legal` and `@voyantjs/notifications`: keep template authoring and Liquid exports available from the package roots while aligning the notification/template surface with the updated booking traveler contract.
  - Supporting packages and tests also picked up repo-wide import-order, lint, and small compatibility cleanups across auth, booking requirements, checkout, octo, pricing, sellability, storefront, and utilities as part of bringing the whole worktree back to a green release state.
  - Align the touched app/template compatibility wrappers with the new primary traveler and workspace surfaces, and keep repo `typecheck` / `lint` green after the broader cleanup.

- Updated dependencies [7619ef0]
  - @voyantjs/bookings@0.6.9
  - @voyantjs/react@0.6.9

## 0.6.8

### Patch Changes

- Updated dependencies [b218885]
  - @voyantjs/bookings@0.6.8
  - @voyantjs/react@0.6.8

## 0.6.7

### Patch Changes

- @voyantjs/bookings@0.6.7
- @voyantjs/react@0.6.7

## 0.6.6

### Patch Changes

- @voyantjs/bookings@0.6.6
- @voyantjs/react@0.6.6

## 0.6.5

### Patch Changes

- Updated dependencies [ae9933b]
  - @voyantjs/bookings@0.6.5
  - @voyantjs/react@0.6.5

## 0.6.4

### Patch Changes

- @voyantjs/bookings@0.6.4
- @voyantjs/react@0.6.4

## 0.6.3

### Patch Changes

- @voyantjs/bookings@0.6.3
- @voyantjs/react@0.6.3

## 0.6.2

### Patch Changes

- @voyantjs/bookings@0.6.2
- @voyantjs/react@0.6.2

## 0.6.1

### Patch Changes

- @voyantjs/bookings@0.6.1
- @voyantjs/react@0.6.1

## 0.6.0

### Minor Changes

- b7d56c5: Add `useBookingPrimaryProduct(bookingId)` hook and make `BookingCancellationDialog` + `BookingGroupSection` self-resolve `productId` (and `optionUnitId`) from the booking's items.

  The hook returns `{ productId, optionUnitId, isPending, isLoading }`, using the canonical "first item with a non-null productId" rule — the same heuristic every consumer was duplicating. Components auto-resolve by default when the prop is `undefined`; pass an explicit string or `null` as an override for multi-product bookings or to force the non-product-scoped policy.

  This fixes a quiet correctness regression where callers who forgot to wire `productId` silently fell back to the default cancellation policy instead of the product-scoped one.

- 521147e: Add canonical booking status presentation helpers to `@voyantjs/bookings-react`:

  - `bookingStatusBadgeVariant: Record<BookingStatus, 'default' | 'secondary' | 'outline' | 'destructive'>` — exhaustive (not `Record<string, …>`), so adding a new booking status becomes a compile error here instead of a silent UX miss in every app.
  - `formatBookingStatus(status)` — humanized label (`"in_progress"` → `"In Progress"`).
  - `bookingStatuses` / `bookingStatusOptions` — status list derived from the Zod schema, ready for Select pickers.
  - `BookingStatus` type (now exported from `./schemas`).

  Registry components in `@voyantjs/ui` (`booking-list`, `booking-detail-page` copies, `status-change-dialog`) drop their duplicated local `statusVariant` / `formatStatus` / `BOOKING_STATUSES` constants and consume these instead — single source of truth.

### Patch Changes

- @voyantjs/bookings@0.6.0
- @voyantjs/react@0.6.0

## 0.5.0

### Minor Changes

- ce72e29: Flesh out the operator booking workspace with React hooks for the sections that already existed on the backend.

  - `@voyantjs/bookings-react`: add hooks for booking items (`useBookingItems`, `useBookingItemMutation`), item-traveler assignment (`useBookingItemTravelers` / `useBookingItemTravelerMutation`), documents (`useBookingDocuments`, `useBookingDocumentMutation`), cancellation (`useBookingCancelMutation`), and convert-from-product (`useBookingConvertMutation`).
  - `@voyantjs/finance-react`: add hooks for booking payment schedules (`useBookingPaymentSchedules`, `useBookingPaymentScheduleMutation`) and booking guarantees (`useBookingGuarantees`, `useBookingGuaranteeMutation`).
  - `@voyantjs/legal-react`: add policy resolution (`useResolvePolicy`) and cancellation evaluation (`useEvaluateCancellation`) hooks that power the structured booking cancellation workflow.

- ce72e29: Add a shared-room / split-booking group model

  Multiple separate bookings can now intentionally share one room/accommodation while each booking keeps its own finance + traveler records. Inspired by the ProTravel v3 `sharing_groups` pattern: flat peer bookings, a lightweight `booking_groups` + `booking_group_members` schema, smart cleanup on cancellation.

  `@voyantjs/bookings`: new `bookingGroups` and `bookingGroupMembers` tables (TypeID prefixes `bkgr` / `bkgm`), service functions for CRUD plus reverse lookup, unified traveler list across members, and automatic group dissolution when a cancellation leaves ≤1 active members. New routes under `/v1/bookings/groups` plus the REST-nested `GET /v1/bookings/:id/group`.

  `@voyantjs/bookings-react`: hooks for `useBookingGroups`, `useBookingGroup`, `useBookingGroupForBooking`, `useBookingGroupMutation`, and `useBookingGroupMemberMutation` (stateless — accepts `groupId` per-call so create-then-add flows work with a single hook instance).

  `@voyantjs/db`: register TypeID prefixes `bkgr` (booking_groups) and `bkgm` (booking_group_members).

### Patch Changes

- Updated dependencies [ce72e29]
  - @voyantjs/bookings@0.5.0
  - @voyantjs/react@0.5.0

## 0.4.5

### Patch Changes

- @voyantjs/bookings@0.4.5
- @voyantjs/react@0.4.5

## 0.4.4

### Patch Changes

- @voyantjs/bookings@0.4.4
- @voyantjs/react@0.4.4

## 0.4.3

### Patch Changes

- @voyantjs/bookings@0.4.3
- @voyantjs/react@0.4.3

## 0.4.2

### Patch Changes

- @voyantjs/bookings@0.4.2
- @voyantjs/react@0.4.2

## 0.4.1

### Patch Changes

- Updated dependencies [4c4ea3c]
  - @voyantjs/bookings@0.4.1
  - @voyantjs/react@0.4.1

## 0.4.0

### Patch Changes

- Updated dependencies [e84fe0f]
  - @voyantjs/bookings@0.4.0
  - @voyantjs/react@0.4.0

## 0.3.1

### Patch Changes

- 8566f2d: Add first-class public booking-session wizard state and storefront repricing.

  `@voyantjs/bookings` now persists wizard session state in `booking_session_states`,
  includes that state in public session reads, exposes public state read/write
  routes, and adds `POST /v1/public/bookings/sessions/:sessionId/reprice` for
  previewing or applying room/unit repricing back onto the booking session.

  `@voyantjs/bookings-react` now exports public session/state query helpers and a
  mutation helper for session state updates and repricing.

- Updated dependencies [8566f2d]
- Updated dependencies [8566f2d]
  - @voyantjs/bookings@0.3.1
  - @voyantjs/react@0.3.1

## 0.3.0

### Patch Changes

- 90bcdb1: Add reusable query-option builders for bookings data so TanStack route loaders can prefetch bookings pages against the shared React Query cache.
- e57725d: Flatten frontend provider wiring around a shared `@voyantjs/react` config provider so module react packages can share one app-level Voyant context.
- Updated dependencies [e57725d]
  - @voyantjs/bookings@0.3.0
  - @voyantjs/react@0.3.0
