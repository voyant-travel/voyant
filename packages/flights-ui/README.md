# @voyantjs/flights-ui

Importable React UI components and page compositions for Voyant flights. Bundler-consumed (Vite, Next.js, webpack, etc.).

## Install

```bash
pnpm add @voyantjs/flights-ui @voyantjs/flights-react @voyantjs/flights @voyantjs/crm-react @voyantjs/ui @tanstack/react-query react react-dom
```

`@voyantjs/ui` provides the design-system primitives. `@voyantjs/flights-react`
provides the data-layer hooks. CRM-backed contact and billing pickers use
`@voyantjs/crm-react`.

## Pages

`FlightsPage` renders the search, filter, per-leg round-trip picker, offer
detail sheet, and booking handoff. The route owns URL validation and navigation:

```tsx
import { FlightsPage } from "@voyantjs/flights-ui"

<FlightsPage
  search={search}
  onSearchChange={(next, options) => updateRouteSearch(next, options)}
  onBookOffer={({ outboundOfferId, returnOfferId, passengers, cabin }) =>
    goToBooking({ outboundOfferId, returnOfferId, passengers, cabin })
  }
/>
```

`FlightBookingPage` renders the repricing, ancillaries, seat-map, passenger,
billing, payment, and confirmation flow around `FlightBookingShell`. The route
or app supplies booking and navigation callbacks:

```tsx
import { FlightBookingPage } from "@voyantjs/flights-ui"

<FlightBookingPage
  outboundOfferId={offerId}
  returnOfferId={returnOfferId}
  passengers={{ adults: 1, children: 0, infants: 0 }}
  paymentCapabilities={{ chargeSavedCard: false, newCard: false }}
  onBackToSearch={() => navigateToFlights()}
  onBook={(request) => bookFlight(request)}
  onBooked={(order) => navigateToBooking(order.orderId)}
/>
```

Router behavior, booking submission, payment capabilities, billing-default
persistence, and contact creation are callbacks or slots so applications keep
deployment-specific ownership.

## I18n

Components render English by default. To localize them, wrap your UI in
`FlightsUiMessagesProvider` and import only the locales your app supports.

```tsx
import { FlightsUiMessagesProvider } from "@voyantjs/flights-ui"
import { flightsUiEn } from "@voyantjs/flights-ui/i18n/en"
import { flightsUiRo } from "@voyantjs/flights-ui/i18n/ro"
```

English-only apps should import only `./i18n/en`. Bilingual apps can import
`./i18n/en` and `./i18n/ro`.
