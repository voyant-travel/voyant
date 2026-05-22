---
"@voyantjs/bookings-ui": minor
---

Add `BookingQuickViewSheet` — a lightweight side-sheet for peeking at a booking from places like allocation grids, calendars, or activity feeds without leaving the current page (issue #1083). Takes `{ bookingId, open, onOpenChange, onViewFull }` and renders the canonical summary shape: number + status badge, dates / pax row, payer contact, sell amount, internal notes, and a "View full booking" footer that hands the loaded `BookingRecord` back to the host. Lets operator templates drop their local clones.
