# @voyantjs/checkout-ui

## 0.26.0

### Patch Changes

- @voyantjs/checkout@0.26.0
- @voyantjs/checkout-react@0.26.0
- @voyantjs/finance@0.26.0
- @voyantjs/finance-react@0.26.0
- @voyantjs/ui@0.26.0

## 0.25.0

### Patch Changes

- @voyantjs/checkout@0.25.0
- @voyantjs/checkout-react@0.25.0
- @voyantjs/finance@0.25.0
- @voyantjs/finance-react@0.25.0
- @voyantjs/ui@0.25.0

## 0.24.3

### Patch Changes

- @voyantjs/checkout@0.24.3
- @voyantjs/checkout-react@0.24.3
- @voyantjs/finance@0.24.3
- @voyantjs/finance-react@0.24.3
- @voyantjs/ui@0.24.3

## 0.24.2

### Patch Changes

- Updated dependencies [bec0471]
  - @voyantjs/checkout@0.24.2
  - @voyantjs/checkout-react@0.24.2
  - @voyantjs/finance@0.24.2
  - @voyantjs/finance-react@0.24.2
  - @voyantjs/ui@0.24.2

## 0.24.1

### Patch Changes

- ed635c7: Expose consistent Tailwind v4 style helper imports across admin and UI packages,
  and document single-tenant auth shell bootstrap without mandatory workspace
  organization routes.
- Updated dependencies [ed635c7]
  - @voyantjs/checkout@0.24.1
  - @voyantjs/checkout-react@0.24.1
  - @voyantjs/finance@0.24.1
  - @voyantjs/finance-react@0.24.1
  - @voyantjs/ui@0.24.1

## 0.24.0

### Patch Changes

- @voyantjs/checkout@0.24.0
- @voyantjs/checkout-react@0.24.0
- @voyantjs/finance@0.24.0
- @voyantjs/finance-react@0.24.0
- @voyantjs/ui@0.24.0

## 0.23.0

### Patch Changes

- @voyantjs/checkout@0.23.0
- @voyantjs/checkout-react@0.23.0
- @voyantjs/finance@0.23.0
- @voyantjs/finance-react@0.23.0
- @voyantjs/ui@0.23.0

## 0.22.0

### Patch Changes

- @voyantjs/checkout@0.22.0
- @voyantjs/checkout-react@0.22.0
- @voyantjs/finance@0.22.0
- @voyantjs/finance-react@0.22.0
- @voyantjs/ui@0.22.0

## 0.21.1

### Patch Changes

- @voyantjs/checkout@0.21.1
- @voyantjs/checkout-react@0.21.1
- @voyantjs/finance@0.21.1
- @voyantjs/finance-react@0.21.1
- @voyantjs/ui@0.21.1

## 0.21.0

### Patch Changes

- Updated dependencies [6427bad]
  - @voyantjs/checkout@0.21.0
  - @voyantjs/checkout-react@0.21.0
  - @voyantjs/finance@0.21.0
  - @voyantjs/finance-react@0.21.0
  - @voyantjs/ui@0.21.0

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
  - @voyantjs/checkout@0.20.0
  - @voyantjs/checkout-react@0.20.0
  - @voyantjs/finance@0.20.0
  - @voyantjs/finance-react@0.20.0
  - @voyantjs/ui@0.20.0
