---
"@voyant-travel/bookings-react": minor
---

Add a `defaultPhoneCountry` prop to `BookingJourney` and derive the phone-input
country from the active i18n locale (falling back to "GB") instead of always
starting at +44.
