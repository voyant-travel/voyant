---
"@voyant-travel/i18n": patch
"@voyant-travel/inventory-react": patch
"@voyant-travel/commerce-react": patch
"@voyant-travel/bookings-react": patch
---

Unify the product booking-mode vocabulary. The products table column, detail
chips, and the editor picker now all use the same short labels (Multi-day tour,
Accommodation, Day trip, Timed activity, Transfer, Open-dated voucher, Other)
instead of the table showing terse words (Itinerary, Date, Stay) while the editor
showed long descriptive ones. The pricing basis (rooms & nights / per person) is
kept as a secondary hint shown only inside the picker.
