# @voyantjs/checkout

## 0.26.6

### Patch Changes

- Updated dependencies [571e340]
  - @voyantjs/bookings@0.26.6
  - @voyantjs/core@0.26.6
  - @voyantjs/finance@0.26.6
  - @voyantjs/hono@0.26.6
  - @voyantjs/notifications@0.26.6

## 0.26.5

### Patch Changes

- @voyantjs/bookings@0.26.5
- @voyantjs/core@0.26.5
- @voyantjs/finance@0.26.5
- @voyantjs/hono@0.26.5
- @voyantjs/notifications@0.26.5

## 0.26.4

### Patch Changes

- @voyantjs/bookings@0.26.4
- @voyantjs/core@0.26.4
- @voyantjs/finance@0.26.4
- @voyantjs/hono@0.26.4
- @voyantjs/notifications@0.26.4

## 0.26.3

### Patch Changes

- @voyantjs/bookings@0.26.3
- @voyantjs/core@0.26.3
- @voyantjs/finance@0.26.3
- @voyantjs/hono@0.26.3
- @voyantjs/notifications@0.26.3

## 0.26.2

### Patch Changes

- @voyantjs/bookings@0.26.2
- @voyantjs/core@0.26.2
- @voyantjs/finance@0.26.2
- @voyantjs/hono@0.26.2
- @voyantjs/notifications@0.26.2

## 0.26.1

### Patch Changes

- Updated dependencies [c0507a6]
  - @voyantjs/bookings@0.26.1
  - @voyantjs/core@0.26.1
  - @voyantjs/finance@0.26.1
  - @voyantjs/hono@0.26.1
  - @voyantjs/notifications@0.26.1

## 0.26.0

### Patch Changes

- @voyantjs/bookings@0.26.0
- @voyantjs/core@0.26.0
- @voyantjs/finance@0.26.0
- @voyantjs/hono@0.26.0
- @voyantjs/notifications@0.26.0

## 0.25.0

### Patch Changes

- @voyantjs/bookings@0.25.0
- @voyantjs/core@0.25.0
- @voyantjs/finance@0.25.0
- @voyantjs/hono@0.25.0
- @voyantjs/notifications@0.25.0

## 0.24.3

### Patch Changes

- @voyantjs/bookings@0.24.3
- @voyantjs/core@0.24.3
- @voyantjs/finance@0.24.3
- @voyantjs/hono@0.24.3
- @voyantjs/notifications@0.24.3

## 0.24.2

### Patch Changes

- bec0471: Republish packages whose 0.24.1 tarballs omitted built `dist` artifacts while their runtime exports pointed at `dist`.
  - @voyantjs/bookings@0.24.2
  - @voyantjs/core@0.24.2
  - @voyantjs/finance@0.24.2
  - @voyantjs/hono@0.24.2
  - @voyantjs/notifications@0.24.2

## 0.24.1

### Patch Changes

- @voyantjs/bookings@0.24.1
- @voyantjs/core@0.24.1
- @voyantjs/finance@0.24.1
- @voyantjs/hono@0.24.1
- @voyantjs/notifications@0.24.1

## 0.24.0

### Patch Changes

- @voyantjs/bookings@0.24.0
- @voyantjs/core@0.24.0
- @voyantjs/finance@0.24.0
- @voyantjs/hono@0.24.0
- @voyantjs/notifications@0.24.0

## 0.23.0

### Patch Changes

- @voyantjs/bookings@0.23.0
- @voyantjs/core@0.23.0
- @voyantjs/finance@0.23.0
- @voyantjs/hono@0.23.0
- @voyantjs/notifications@0.23.0

## 0.22.0

### Patch Changes

- @voyantjs/bookings@0.22.0
- @voyantjs/core@0.22.0
- @voyantjs/finance@0.22.0
- @voyantjs/hono@0.22.0
- @voyantjs/notifications@0.22.0

## 0.21.1

### Patch Changes

- @voyantjs/bookings@0.21.1
- @voyantjs/core@0.21.1
- @voyantjs/finance@0.21.1
- @voyantjs/hono@0.21.1
- @voyantjs/notifications@0.21.1

## 0.21.0

### Minor Changes

- 6427bad: Release the booking journey architecture train.

  This adds booking hold policy support, richer traveler and booking journey flows, operator tax policy configuration, finance billing and tax policy APIs, notification reminder target and delivery tooling, and the template/runtime wiring needed for the operator storefront checkout flow.

### Patch Changes

- Updated dependencies [6427bad]
  - @voyantjs/bookings@0.21.0
  - @voyantjs/core@0.21.0
  - @voyantjs/finance@0.21.0
  - @voyantjs/hono@0.21.0
  - @voyantjs/notifications@0.21.0

## 0.20.0

### Minor Changes

- cc3eddd: **Checkout layering: rename `payments-ui` → `checkout-ui`, add `checkout-react`, and centralise the universal payment UX on top of the existing checkout/finance stack.**

  The "payments" domain previously had a single `@voyantjs/payments-ui` component package with no matching backend or hooks layer, while orchestration already lived in `@voyantjs/checkout` and state in `@voyantjs/finance`. The naming was confusing (no `payments` package to match `payments-ui`) and verticals had to hand-roll fetch calls for the admin "Collect payment" and customer landing flows. This release rationalises the stack:

  - **Renamed** `@voyantjs/payments-ui` → `@voyantjs/checkout-ui`. Same components (`<PaymentStep>`, `<PaymentLinkLandingPage>`) plus a new `<CollectPaymentDialog>`. Old name is gone — update imports.
  - **New** `@voyantjs/checkout-react` package: `useInitiateCheckoutCollection`, `usePreviewCheckoutCollection`, `useCheckoutPaymentLinkConfig`, and a higher-level `useCollectPayment(bookingId)` that maps a `PaymentChoice` to the right `initiateCheckoutCollection` request body. Re-exports the public-side `usePublicPaymentSession` / `usePublicBookingPaymentOptions` from `finance-react` so consumers don't need a second import. Owns the canonical `PaymentChoice`, `PaymentStepCapabilities`, `SavedPaymentAccount` types (re-exported by `checkout-ui` for backward-compatible single-import).
  - **`createCheckoutAdminRoutes(options)`** now mounts `collection-plan`, `initiate-collection`, and `collections/bootstrap` alongside the existing `reminder-runs` route, so admin (`actor=staff`) callers don't need a hand-rolled proxy. The public surface is unchanged.
  - **`<PaymentStep>`** simplified: dropped `send_link` and `bank_transfer` from `PaymentChoice` and the corresponding capability flags. The customer's card-vs-bank-transfer decision happens on the public `/pay/:sessionId` landing page, not on the admin picker. Admin choices are now `saved_method | new_card | extra | hold`. `hold` is the universal "create a payment session and share the link" path; vertical extras (e.g. flights' "Issue on agency credit") render unchanged.
  - **`useCollectPayment`** accepts `payerLanguage`, `returnUrl`, `cancelUrl`, `notes` per call so the processor's hosted page renders in the customer's locale and lands them back on the right confirmation route. The Netopia plugin honors all four via `startProvider.payload`.
  - **`<PaymentLinkLandingPage>`** gains an `onRetry` slot. Failed/expired sessions get a `Try again` button that calls the parent's retry handler (the operator template wires it to `POST /v1/public/payment-link/:sessionId/retry`, which mints a fresh session for the same target). Also surfaces `session.notes` as a subtitle so the customer sees what they're paying for.
  - **`PublicPaymentSession`** schema (`@voyantjs/finance/public-validation`) gains a `notes: string | null` field. The public projection passes through whatever was stored on the session at creation.
  - **Netopia callback (`@voyantjs/plugin-netopia`)** drops the strict amount/currency-equality check. Netopia auto-converts non-RON orders to RON for processing, so an EUR session legitimately receives a RON-denominated callback — the previous check rejected every cross-currency payment as `amount_or_currency_mismatch`. Status is the trustworthy field (matches `protravel-v3`'s production handler).
  - **`NETOPIA_MODE=sandbox|live`** replaces hard-coded `NETOPIA_URL`. Defaults to sandbox. `NETOPIA_API_BASES` exports the resolved hosts; `NETOPIA_URL` is now an optional override for staging proxies.
  - **`<FlightPaymentStep>`** updated for the simpler `PaymentChoice` shape. Drops the obsolete `onRequestPaymentLink` callback (Hold IS that flow now). The flight booking shell's `paymentCapabilities` only needs `chargeSavedCard` / `newCard` now.

  Migration: imports of `@voyantjs/payments-ui` → `@voyantjs/checkout-ui`. If you used `paymentCapabilities.sendLink` or `bankTransfer`, drop those — they're no longer in the type. If you wired `onRequestPaymentLink`, point that callback's behavior into the `hold` choice instead.

### Patch Changes

- Updated dependencies [cc3eddd]
  - @voyantjs/bookings@0.20.0
  - @voyantjs/core@0.20.0
  - @voyantjs/finance@0.20.0
  - @voyantjs/hono@0.20.0
  - @voyantjs/notifications@0.20.0

## 0.19.0

### Patch Changes

- Updated dependencies [714c544]
  - @voyantjs/bookings@0.19.0
  - @voyantjs/core@0.19.0
  - @voyantjs/finance@0.19.0
  - @voyantjs/hono@0.19.0
  - @voyantjs/notifications@0.19.0

## 0.18.0

### Patch Changes

- Updated dependencies [8932f60]
  - @voyantjs/bookings@0.18.0
  - @voyantjs/core@0.18.0
  - @voyantjs/finance@0.18.0
  - @voyantjs/hono@0.18.0
  - @voyantjs/notifications@0.18.0

## 0.17.0

### Patch Changes

- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
  - @voyantjs/bookings@0.17.0
  - @voyantjs/core@0.17.0
  - @voyantjs/finance@0.17.0
  - @voyantjs/hono@0.17.0
  - @voyantjs/notifications@0.17.0

## 0.16.0

### Patch Changes

- @voyantjs/bookings@0.16.0
- @voyantjs/core@0.16.0
- @voyantjs/finance@0.16.0
- @voyantjs/hono@0.16.0
- @voyantjs/notifications@0.16.0

## 0.15.0

### Patch Changes

- @voyantjs/bookings@0.15.0
- @voyantjs/core@0.15.0
- @voyantjs/finance@0.15.0
- @voyantjs/hono@0.15.0
- @voyantjs/notifications@0.15.0

## 0.14.0

### Patch Changes

- Updated dependencies [93fd1a5]
  - @voyantjs/bookings@0.14.0
  - @voyantjs/core@0.14.0
  - @voyantjs/finance@0.14.0
  - @voyantjs/hono@0.14.0
  - @voyantjs/notifications@0.14.0

## 0.13.0

### Patch Changes

- Updated dependencies [7dfbc05]
- Updated dependencies [15dda79]
  - @voyantjs/bookings@0.13.0
  - @voyantjs/core@0.13.0
  - @voyantjs/finance@0.13.0
  - @voyantjs/hono@0.13.0
  - @voyantjs/notifications@0.13.0

## 0.12.0

### Patch Changes

- Updated dependencies [944d244]
- Updated dependencies [cc561ce]
  - @voyantjs/bookings@0.12.0
  - @voyantjs/core@0.12.0
  - @voyantjs/finance@0.12.0
  - @voyantjs/hono@0.12.0
  - @voyantjs/notifications@0.12.0

## 0.11.0

### Patch Changes

- Updated dependencies [fe905b0]
  - @voyantjs/bookings@0.11.0
  - @voyantjs/core@0.11.0
  - @voyantjs/finance@0.11.0
  - @voyantjs/hono@0.11.0
  - @voyantjs/notifications@0.11.0

## 0.10.0

### Patch Changes

- Updated dependencies [29a581a]
- Updated dependencies [29a581a]
- Updated dependencies [29a581a]
- Updated dependencies [29a581a]
- Updated dependencies [29a581a]
- Updated dependencies [29a581a]
- Updated dependencies [29a581a]
- Updated dependencies [29a581a]
- Updated dependencies [b7f0501]
  - @voyantjs/bookings@0.10.0
  - @voyantjs/core@0.10.0
  - @voyantjs/finance@0.10.0
  - @voyantjs/hono@0.10.0
  - @voyantjs/notifications@0.10.0

## 0.9.0

### Patch Changes

- @voyantjs/bookings@0.9.0
- @voyantjs/core@0.9.0
- @voyantjs/finance@0.9.0
- @voyantjs/hono@0.9.0
- @voyantjs/notifications@0.9.0

## 0.8.0

### Patch Changes

- @voyantjs/bookings@0.8.0
- @voyantjs/core@0.8.0
- @voyantjs/finance@0.8.0
- @voyantjs/hono@0.8.0
- @voyantjs/notifications@0.8.0

## 0.7.0

### Patch Changes

- Updated dependencies [96612b3]
  - @voyantjs/bookings@0.7.0
  - @voyantjs/core@0.7.0
  - @voyantjs/finance@0.7.0
  - @voyantjs/hono@0.7.0
  - @voyantjs/notifications@0.7.0

## 0.6.9

### Patch Changes

- Updated dependencies [7619ef0]
  - @voyantjs/bookings@0.6.9
  - @voyantjs/core@0.6.9
  - @voyantjs/finance@0.6.9
  - @voyantjs/hono@0.6.9
  - @voyantjs/notifications@0.6.9

## 0.6.8

### Patch Changes

- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
  - @voyantjs/bookings@0.6.8
  - @voyantjs/core@0.6.8
  - @voyantjs/finance@0.6.8
  - @voyantjs/hono@0.6.8
  - @voyantjs/notifications@0.6.8

## 0.6.7

### Patch Changes

- @voyantjs/bookings@0.6.7
- @voyantjs/core@0.6.7
- @voyantjs/finance@0.6.7
- @voyantjs/hono@0.6.7
- @voyantjs/notifications@0.6.7

## 0.6.6

### Patch Changes

- @voyantjs/bookings@0.6.6
- @voyantjs/core@0.6.6
- @voyantjs/finance@0.6.6
- @voyantjs/hono@0.6.6
- @voyantjs/notifications@0.6.6

## 0.6.5

### Patch Changes

- Updated dependencies [ae9933b]
  - @voyantjs/bookings@0.6.5
  - @voyantjs/core@0.6.5
  - @voyantjs/finance@0.6.5
  - @voyantjs/hono@0.6.5
  - @voyantjs/notifications@0.6.5

## 0.6.4

### Patch Changes

- @voyantjs/bookings@0.6.4
- @voyantjs/core@0.6.4
- @voyantjs/finance@0.6.4
- @voyantjs/hono@0.6.4
- @voyantjs/notifications@0.6.4

## 0.6.3

### Patch Changes

- Updated dependencies [93d3734]
- Updated dependencies [d3c6937]
  - @voyantjs/bookings@0.6.3
  - @voyantjs/core@0.6.3
  - @voyantjs/finance@0.6.3
  - @voyantjs/hono@0.6.3
  - @voyantjs/notifications@0.6.3

## 0.6.2

### Patch Changes

- @voyantjs/bookings@0.6.2
- @voyantjs/core@0.6.2
- @voyantjs/finance@0.6.2
- @voyantjs/hono@0.6.2
- @voyantjs/notifications@0.6.2

## 0.6.1

### Patch Changes

- @voyantjs/bookings@0.6.1
- @voyantjs/core@0.6.1
- @voyantjs/finance@0.6.1
- @voyantjs/hono@0.6.1
- @voyantjs/notifications@0.6.1

## 0.6.0

### Patch Changes

- @voyantjs/bookings@0.6.0
- @voyantjs/core@0.6.0
- @voyantjs/finance@0.6.0
- @voyantjs/hono@0.6.0
- @voyantjs/notifications@0.6.0

## 0.5.0

### Patch Changes

- Updated dependencies [ce72e29]
  - @voyantjs/bookings@0.5.0
  - @voyantjs/core@0.5.0
  - @voyantjs/finance@0.5.0
  - @voyantjs/hono@0.5.0
  - @voyantjs/notifications@0.5.0

## 0.4.5

### Patch Changes

- Updated dependencies [e3f6e72]
  - @voyantjs/bookings@0.4.5
  - @voyantjs/core@0.4.5
  - @voyantjs/finance@0.4.5
  - @voyantjs/hono@0.4.5
  - @voyantjs/notifications@0.4.5

## 0.4.4

### Patch Changes

- Updated dependencies [9349604]
  - @voyantjs/bookings@0.4.4
  - @voyantjs/core@0.4.4
  - @voyantjs/finance@0.4.4
  - @voyantjs/hono@0.4.4
  - @voyantjs/notifications@0.4.4

## 0.4.3

### Patch Changes

- 02119e0: Add a unified checkout bootstrap contract that accepts either a booking id or
  session id and can start exact-amount card or bank-transfer collection through
  one request path.
  - @voyantjs/bookings@0.4.3
  - @voyantjs/core@0.4.3
  - @voyantjs/finance@0.4.3
  - @voyantjs/hono@0.4.3
  - @voyantjs/notifications@0.4.3

## 0.4.2

### Patch Changes

- Updated dependencies [8de4602]
  - @voyantjs/bookings@0.4.2
  - @voyantjs/core@0.4.2
  - @voyantjs/finance@0.4.2
  - @voyantjs/hono@0.4.2
  - @voyantjs/notifications@0.4.2

## 0.4.1

### Patch Changes

- Updated dependencies [4c4ea3c]
- Updated dependencies [a49630a]
  - @voyantjs/bookings@0.4.1
  - @voyantjs/core@0.4.1
  - @voyantjs/finance@0.4.1
  - @voyantjs/hono@0.4.1
  - @voyantjs/notifications@0.4.1

## 0.4.0

### Patch Changes

- e84fe0f: Add a fuller storefront payment bootstrap surface to checkout.

  - allow exact-amount collection overrides in checkout plans and initiation
  - return customer-safe bank transfer instructions from checkout when configured
  - support combined provider startup in checkout through injected payment
    starters
  - add a Netopia checkout starter helper in `@voyantjs/plugin-netopia`

- e84fe0f: Add invoice-targeted reminder rules and runs so unpaid invoice/proforma
  documents created for bank-transfer checkout flows can use the same first-class
  reminder engine and checkout reminder visibility as schedule-backed reminders.
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
  - @voyantjs/bookings@0.4.0
  - @voyantjs/core@0.4.0
  - @voyantjs/finance@0.4.0
  - @voyantjs/hono@0.4.0
  - @voyantjs/notifications@0.4.0

## 0.3.1

### Patch Changes

- 8566f2d: Formalize checkout as a first-class Voyant module and add admin reminder
  tracking.

  `@voyantjs/checkout` now exposes a `createCheckoutHonoModule()` helper,
  typed response schemas for collection plans and initiated collections, and an
  admin `GET /v1/admin/checkout/bookings/:bookingId/reminder-runs` route backed by
  notification reminder runs. The operator, dmc, and dev templates now mount
  checkout through the module system and explicitly keep `/v1/checkout/*`
  available as a public path.

- Updated dependencies [8566f2d]
- Updated dependencies [8566f2d]
- Updated dependencies [8566f2d]
- Updated dependencies [8566f2d]
  - @voyantjs/bookings@0.3.1
  - @voyantjs/core@0.3.1
  - @voyantjs/finance@0.3.1
  - @voyantjs/hono@0.3.1
  - @voyantjs/notifications@0.3.1

## 0.3.0

### Patch Changes

- @voyantjs/bookings@0.3.0
- @voyantjs/core@0.3.0
- @voyantjs/finance@0.3.0
- @voyantjs/hono@0.3.0
- @voyantjs/notifications@0.3.0

## 0.2.0

### Patch Changes

- 45db219: Fix the published package layout so build output lands at `dist/*` instead of `dist/src/*`, matching the package exports.
  - @voyantjs/bookings@0.2.0
  - @voyantjs/core@0.2.0
  - @voyantjs/finance@0.2.0
  - @voyantjs/hono@0.2.0
  - @voyantjs/notifications@0.2.0

## 0.1.1

### Patch Changes

- @voyantjs/bookings@0.1.1
- @voyantjs/core@0.1.1
- @voyantjs/finance@0.1.1
- @voyantjs/hono@0.1.1
- @voyantjs/notifications@0.1.1
