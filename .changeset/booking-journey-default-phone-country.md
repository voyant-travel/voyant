---
"@voyant-travel/bookings-react": patch
---

Make the booking journey's default phone country configurable via a new `defaultPhoneCountry` prop, with a locale-derived region fallback and GB only as the last resort instead of always defaulting to the UK.
