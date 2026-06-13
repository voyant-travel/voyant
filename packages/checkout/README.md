# @voyantjs/checkout

Compatibility entrypoint for Voyant checkout and collection orchestration.

The runtime owner is now `@voyantjs/finance`. Import new code from
`@voyantjs/finance/checkout`, `@voyantjs/finance/checkout-routes`, or
`@voyantjs/finance/checkout-validation`. This package remains as a shim for
existing consumers and delegates to the Finance-owned services and routes.

Checkout does not implement payment providers. Instead, the Finance checkout
service decides which booking schedule or invoice to collect, creates the right
finance record, and can dispatch notifications through host-provided wiring.

## What it does

- previews a booking collection plan
- creates bank-transfer collection documents (`proforma` by default)
- supports exact-amount collection overrides by falling back to invoice-backed
  collection when the requested amount does not match an existing schedule
- creates card collection `payment_sessions`
- supports schedule-backed or invoice-backed card collection
- can start the provider flow in the same checkout request when a payment
  starter is configured
- can return customer-safe bank-transfer instructions when a bank-transfer
  resolver is configured
- optionally sends invoice or payment-session notifications

## Routes

Finance owner routes:

- `POST /v1/public/finance/bookings/:bookingId/collection-plan`
- `POST /v1/public/finance/bookings/:bookingId/initiate-collection`
- `POST /v1/public/finance/collections/bootstrap`
- `GET /v1/admin/finance/bookings/:bookingId/reminder-runs`

The legacy checkout route helpers remain available from this package for
compatibility.

## Notes

- payment-provider adapters like Netopia remain optional
- provider startup is injected through `paymentStarters` or
  `resolvePaymentStarters`
- bank-transfer instructions are injected through `bankTransferDetails` or
  `resolveBankTransferDetails`
- notification delivery remains app-owned and is injected through a dispatcher
  or provider wiring
- projects can override the default collection policy when mounting checkout
- `createCheckoutHonoModule()` remains as a compatibility module; prefer
  `createFinanceHonoModule()` for new wiring
- third parties can still ship provider integrations as plugin bundles, but
  checkout itself stays provider-agnostic
