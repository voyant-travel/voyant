# `@voyant-travel/storefront-sdk`

Framework-agnostic TypeScript client for custom Voyant storefronts.

The SDK does not own HTTP routes. It wraps the existing public contracts from
`@voyant-travel/storefront`, `@voyant-travel/bookings`, and `@voyant-travel/finance` behind a
single typed client so custom booking UIs can consume Voyant booking logic
without stitching together package-local fetchers.

```ts
import { createVoyantStorefrontClient } from "@voyant-travel/storefront-sdk"

const voyant = createVoyantStorefrontClient({
  baseUrl: "https://operator.example.com",
})

const session = await voyant.booking.createSession({
  sellCurrency: "EUR",
  items: [
    {
      title: "Danube tour",
      availabilitySlotId: "slot_123",
      quantity: 2,
      totalSellAmountCents: 24000,
    },
  ],
})

const state = voyant.booking.deriveState(session)
```

Use `voyant.booking.bootstrapSession(...)` or the lower-level
`bootstrapBookingSession(...)` operation when the storefront has a selected
departure slot and quote and needs the native combined bootstrap payload:
session, availability, repricing, payment plan/schedule, allocation, and the
checkout capability attached at `session.checkoutCapability`. Use
`voyant.booking.createSession(...)` / `createPublicBookingSession(...)` only
when the UI intentionally wants to reserve a bare public booking session and
orchestrate pricing, availability, and payment setup separately.

For custom booking engines, prefer the `bookingEngine` facade. It keeps the
route-shaped public booking and checkout calls behind flow-oriented methods and
returns a canonical engine snapshot alongside session reads and mutations.

```ts
const booking = await voyant.bookingEngine.reserve({
  sellCurrency: "EUR",
  items: [
    {
      title: "Danube tour",
      availabilitySlotId: "slot_123",
      quantity: 2,
      totalSellAmountCents: 24000,
    },
  ],
})

if (voyant.bookingEngine.canRunAction(booking.engine.state, "start_payment")) {
  await voyant.bookingEngine.startPayment(booking.session.sessionId, {
    method: "card",
  })
}
```

React consumers should layer React Query hooks on top of this package rather
than reimplementing request paths directly.
