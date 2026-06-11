---
"@voyantjs/catalog-contracts": minor
"@voyantjs/catalog": patch
"@voyantjs/catalog-react": patch
"@voyantjs/bookings-react": patch
---

Move shared booking-engine client/server types into `@voyantjs/catalog-contracts`.

`BookingDraftShape` and the draft-shape descriptor types + defaults (`PaxBandSpec`, `PaxBandDependency`, `DEFAULT_PAX_BANDS`, `defaultDraftShapeFlags`, `defaultTravelerFields`, `defaultBookingFields`, `paxBandsAllowedTotalFrom`, …) now live at `@voyantjs/catalog-contracts/booking-engine/draft-shape`, and `BookingPaymentIntent` joins the V1 wire contracts at `@voyantjs/catalog-contracts/booking-engine/contracts`. This removes the layering leak where client packages (`@voyantjs/bookings-react`, `@voyantjs/catalog-react`) imported contract types from the backend `@voyantjs/catalog/booking-engine` entry — both now depend on `@voyantjs/catalog-contracts` instead and no longer depend on `@voyantjs/catalog` at all.

`@voyantjs/catalog/booking-engine` re-exports all moved symbols, so existing backend importers keep working with zero changes.
