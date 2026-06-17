---
"@voyant-travel/cruises": patch
---

Fix `cruises/src/schema.ts` to re-export `cruiseAirArrangementEnum` from the booking-extension. The barrel re-exported `bookingCruiseDetails` (which has an `air_arrangement` column) and `cruiseBookingModeEnum`, but omitted `cruiseAirArrangementEnum` — so schema discovery (drizzle) saw a table referencing an enum it never created (surfaced by the D.1 replay-parity oracle). A schema barrel must re-export every enum its re-exported tables use.
