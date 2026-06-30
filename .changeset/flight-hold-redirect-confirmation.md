---
"@voyant-travel/flights-react": patch
---

Fix the flight booking wizard landing on a "Booking not found" page after a hold. A flight hold persists a flight order (served at `/v1/admin/flights/orders/:id`), which is a separate entity from a catalog booking and is not resolvable at `/bookings/:id`. The admin wizard previously navigated to the catalog `booking.detail` destination, which 404s for a flight order id. It now renders an inline flight order confirmation from the booking response instead — a readable order surface with no extra fetch.
