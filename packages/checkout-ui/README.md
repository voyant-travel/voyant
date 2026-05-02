# @voyantjs/checkout-ui

Universal payment UI components built on the existing Voyant payments
stack:

- `@voyantjs/finance` — `payment_sessions`, `payments`, `payment_instruments`
- `@voyantjs/checkout` — collection plans + `paymentStarters` registration
- `@voyantjs/plugin-netopia` (and future plugins) — real processor adapters
- `@voyantjs/notifications` — payment-link emails

This package adds **pure UI** on top of that stack — no parallel state,
no parallel contracts. Verticals wrap `<PaymentStep>` and translate
`PaymentChoice` events into checkout calls.

## Components

### `<PaymentStep>`

Capability-driven payment picker. The parent passes a
`PaymentStepCapabilities` boolean record built from what's actually
wired (a configured `paymentStarter`, `bankTransferDetails` registered,
saved methods on file).

| Section | Visible when |
|---|---|
| Saved cards on file | `capabilities.chargeSavedCard` |
| Send payment link | `capabilities.sendLink` |
| Charge a new card now | `capabilities.newCard` |
| Bank transfer (manual) | `capabilities.bankTransfer` |
| Vertical-specific extras | always (e.g. "Issue on credit" for flights) |
| Hold seats — pay later | always (unless `hideHoldOption`) |

Saved methods are typed against `PublicBookingPaymentOptionsRecord["accounts"][number]`
from `@voyantjs/finance/public-validation` — single source of truth.

### `<PaymentLinkLandingPage>`

The customer's view of a payment link. Takes a `PublicPaymentSession`
from `@voyantjs/finance/public-validation` and renders the order
summary, Pay-by-card button (redirects to `session.redirectUrl`), and
optional Bank-transfer block (template-supplied IBAN).

Terminal states (paid / failed / expired / cancelled / processing)
short-circuit the body to a status panel.

## Architecture

See [`docs/architecture/payments-architecture.md`](../../docs/architecture/payments-architecture.md).
