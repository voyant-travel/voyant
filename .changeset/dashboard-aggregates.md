---
"@voyantjs/bookings": patch
"@voyantjs/finance": patch
---

Server-side dashboard aggregates: add `totalPax` and `upcomingDepartures.items` to `getBookingAggregates`, and `outstandingTopN` to `getFinanceAggregates` (closes #437).

The operator dashboard previously sampled the first 100 bookings / invoices through the list endpoints and derived KPIs in the browser. With more than a handful of rows, "total pax", "upcoming departures", and "outstanding invoices" silently drifted from the truth.

Bookings:

- `BookingAggregates.totalPax` sums `pax` across active-status bookings in the requested range (cancelled excluded; null pax = 0).
- `BookingAggregates.upcomingDepartures` is now `{ count, items }`. `items` is a bounded slice of soonest-departing bookings ordered by `start_date` asc, excluding cancelled and past departures. Bound via the new `upcomingLimit` query parameter (default 8, max 20).

Finance:

- `FinanceAggregates.outstandingTopN` returns the top-N outstanding invoices (`sent | partially_paid | overdue` with `balance_due_cents > 0`), ordered by `due_date` (nulls last), then `issue_date`, then `id`. Bound via the new `outstandingTopLimit` query parameter (default 5, max 20).

The operator dashboard is rewired to consume these aggregates directly — KPI cards, the upcoming-departures list, and the "needs collection" panel are now exact rather than sample-derived. The dashboard also fixes a pre-existing bug where the outstanding panel summed `total_amount_cents` instead of `balance_due_cents`.
