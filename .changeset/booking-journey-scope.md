---
"@voyant-travel/bookings-react": patch
"@voyant-travel/catalog-react": patch
---

Thread pricing/content scope through the booking journey. `BookingJourney` now accepts an optional `scope` (`market`/`currency`/`locale`/`audience`) and forwards it to its live quote, and `useBookingQuote` includes scope in its React Query key so changing the selected market/currency re-quotes instead of showing a stale price. Storefronts pass the shopper's selected scope so checkout prices in the same market/currency as browse and detail (voyant#2643). Omitting `scope` keeps the previous per-surface default behavior, so admin surfaces are unaffected.
