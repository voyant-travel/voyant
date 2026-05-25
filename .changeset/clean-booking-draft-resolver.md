---
"@voyantjs/bookings-ui": patch
"@voyantjs/bookings-react": patch
"@voyantjs/bookings": patch
"@voyantjs/finance": patch
---

Resolve booking-create traveler unit assignments through a shared draft resolver so person-priced excursions derive adult/child/infant quantities from travelers while accommodation products preserve room quantities. Booking-create item and extra lines can now carry traveler applicability through to `booking_item_travelers`.
