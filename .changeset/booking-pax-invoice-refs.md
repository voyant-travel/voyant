---
"@voyant-travel/bookings-react": patch
"@voyant-travel/finance-react": patch
---

Density-audit copy fixes. The booking detail header now reads "N travelers"
instead of "N PAX". On the invoice detail, the Booking / Person / Organization
links no longer display raw record IDs — they show a clear "View booking" /
"View person" / "View organization" action (matching the payment detail page),
since the invoice record doesn't carry resolved names.
