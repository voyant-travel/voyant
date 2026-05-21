---
"@voyantjs/availability": minor
"@voyantjs/availability-react": minor
"@voyantjs/allocation-ui": minor
---

Allocation view: click traveler's booking number to open it; color-code chips by payment status.

`@voyantjs/availability`
- Slot allocation manifest now carries an aggregated `paymentStatus` (`paid` / `partial` / `unpaid`) on both `AllocationManifestBooking` and `AllocationManifestTraveler`. Derived from a LEFT JOIN against `invoices` (sum of `total_cents` / `paid_cents` per booking, excluding `void` invoices):
  - `paid` when fully settled, or when the booking has `sell_amount_cents <= 0` (free).
  - `partial` when any payment landed but balance remains.
  - `unpaid` when nothing has been paid, including the "no invoices issued yet" case.
- Fallback path: when the `invoices` table doesn't exist (catalog-less / finance-less deploys), the loader retries without the join and every booking ends up `unpaid`. No crash on missing schema.
- New exported type `AllocationPaymentStatus`.

`@voyantjs/availability-react`
- `allocationManifestTravelerSchema` and `allocationManifestBookingSchema` expose `paymentStatus` (defaults to `unpaid` for older API responses).
- New exports: `allocationPaymentStatusSchema`, `AllocationPaymentStatus`.

`@voyantjs/allocation-ui`
- `SlotAllocationPage` accepts a new `onBookingOpen?: (bookingId: string) => void` callback. When provided, every booking number on a chip / row becomes a `<button>` that fires the callback — the host decides whether to open a side panel, navigate, etc. Threaded through `ResourceColumnsView`, `ResourceGroupTable`, `ResourceRow`, `TravelerChip`, `UnallocatedTravelersTable`, `VehicleSeatsView`, and `VehicleSeatCell`.
- `TravelerChip` border + background tint reflects `traveler.paymentStatus` — emerald for paid, amber for partial, rose for unpaid (light tint over the existing border). Tooltip surfaces the localized label.
- Unallocated rows pick up the same color cue (text-only, not full-width) on the booking-number column so a quick scan tells the operator what's outstanding.
- New `paymentStatusLabels` i18n group on `AllocationUiMessages` (EN + RO).
