# `@voyantjs/storefront-sdk`

Framework-agnostic TypeScript client for custom Voyant storefronts.

The SDK does not own HTTP routes. It wraps the existing public contracts from
`@voyantjs/storefront`, `@voyantjs/bookings`, and `@voyantjs/checkout` behind a
single typed client so custom booking UIs can consume Voyant booking logic
without stitching together package-local fetchers.

```ts
import { createVoyantStorefrontClient } from "@voyantjs/storefront-sdk"

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
