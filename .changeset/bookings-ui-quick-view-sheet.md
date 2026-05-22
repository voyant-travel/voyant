---
"@voyantjs/bookings-ui": minor
---

Add `BookingQuickViewSheet` — a side-sheet for peeking at a booking from places like allocation grids, calendars, or activity feeds without leaving the current page (issue #1083). Takes `{ bookingId, open, onOpenChange, onViewFull }` and renders the canonical operator summary: booking number + status badge, sell amount, dates / pax row, payer name + phone, then five quick sections — **Travelers** (with category badges and `count/expected` counter), **Payments** (Paid / Remaining derived from completed payments vs. sell amount), **Invoices**, **Payment schedule** (with `paid/total paid` counter), and **Contracts** (with the "Not generated." empty state) — plus a "View full booking" footer that hands the loaded `BookingRecord` back to the host. Lets operator templates drop their local clones.
