---
"@voyantjs/availability": minor
"@voyantjs/availability-react": minor
"@voyantjs/allocation-ui": minor
---

Allocation chip polish:

- **Fix #1079**: `derivePaymentStatus` now falls back to `bookings.paid_at` and the sum of paid `booking_payment_schedules` before declaring a booking unpaid via invoice math. Operators who bill via deposit milestones (or who confirm bookings without issuing an invoice) no longer see false-red allocation chips. Manifest SQL surfaces `paid_at`, `created_at`, and `schedules_paid_cents`; the rollup checks them in order before falling through to the legacy invoice rule.
- **Booking sequence numbers**: each booking gets a slot-local 1-based ordinal (by `bookings.created_at`), surfaced on `AllocationManifestBooking` and `AllocationManifestTraveler` as `bookingSequence`. All chips for the same booking render with a `(N)` prefix so operators can scan the resource grid and spot at a glance which travelers belong together.
- **Visible payment-status colors**: `paymentStatusChipClass` bumped from `/5 + /40` (basically invisible on dark themes) to `/20 + /70` plus an explicit text color. Lives in `slot-allocation-shared` so both the resource view and the seat view share the same look.
- **Seat-view parity**: `VehicleSeatCell` now applies the payment-status color + tooltip and shows the `(N)` prefix on the occupant name. The booking ref click-through was already there; this aligns the rest of the affordances with the room view.
