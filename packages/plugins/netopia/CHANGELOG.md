# @voyantjs/plugin-netopia

## 0.24.1

### Patch Changes

- @voyantjs/checkout@0.24.1
- @voyantjs/core@0.24.1
- @voyantjs/finance@0.24.1
- @voyantjs/hono@0.24.1
- @voyantjs/notifications@0.24.1

## 0.24.0

### Patch Changes

- @voyantjs/checkout@0.24.0
- @voyantjs/core@0.24.0
- @voyantjs/finance@0.24.0
- @voyantjs/hono@0.24.0
- @voyantjs/notifications@0.24.0

## 0.23.0

### Patch Changes

- @voyantjs/checkout@0.23.0
- @voyantjs/core@0.23.0
- @voyantjs/finance@0.23.0
- @voyantjs/hono@0.23.0
- @voyantjs/notifications@0.23.0

## 0.22.0

### Patch Changes

- @voyantjs/checkout@0.22.0
- @voyantjs/core@0.22.0
- @voyantjs/finance@0.22.0
- @voyantjs/hono@0.22.0
- @voyantjs/notifications@0.22.0

## 0.21.1

### Patch Changes

- @voyantjs/checkout@0.21.1
- @voyantjs/core@0.21.1
- @voyantjs/finance@0.21.1
- @voyantjs/hono@0.21.1
- @voyantjs/notifications@0.21.1

## 0.21.0

### Patch Changes

- Updated dependencies [6427bad]
  - @voyantjs/checkout@0.21.0
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
  - @voyantjs/checkout@0.20.0
  - @voyantjs/core@0.20.0
  - @voyantjs/finance@0.20.0
  - @voyantjs/hono@0.20.0
  - @voyantjs/notifications@0.20.0

## 0.19.0

### Patch Changes

- Updated dependencies [714c544]
  - @voyantjs/checkout@0.19.0
  - @voyantjs/core@0.19.0
  - @voyantjs/finance@0.19.0
  - @voyantjs/hono@0.19.0
  - @voyantjs/notifications@0.19.0

## 0.18.0

### Patch Changes

- @voyantjs/checkout@0.18.0
- @voyantjs/core@0.18.0
- @voyantjs/finance@0.18.0
- @voyantjs/hono@0.18.0
- @voyantjs/notifications@0.18.0

## 0.17.0

### Patch Changes

- 66d722d: `financeService.completePaymentSession` now accepts a 4th `runtime: { eventBus? }` parameter and emits `invoice.settled` after the transaction commits when a payment is applied to an invoice. Closes a fan-out gap where plugin callbacks (Netopia and friends) had to either run a separate poller or wrap each provider callback to manually trigger `pollInvoiceSettlement`. The Netopia plugin's callback route now resolves the finance runtime from the container and threads the eventBus through `handleCallback`.

  Default callers (no runtime) remain unchanged. `pollInvoiceSettlement` continues to emit independently — no double-emit, since it goes through `createPayment`, not `completePaymentSession`.

- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
  - @voyantjs/checkout@0.17.0
  - @voyantjs/core@0.17.0
  - @voyantjs/finance@0.17.0
  - @voyantjs/hono@0.17.0
  - @voyantjs/notifications@0.17.0

## 0.16.0

### Patch Changes

- @voyantjs/checkout@0.16.0
- @voyantjs/core@0.16.0
- @voyantjs/finance@0.16.0
- @voyantjs/hono@0.16.0
- @voyantjs/notifications@0.16.0

## 0.15.0

### Patch Changes

- @voyantjs/checkout@0.15.0
- @voyantjs/core@0.15.0
- @voyantjs/finance@0.15.0
- @voyantjs/hono@0.15.0
- @voyantjs/notifications@0.15.0

## 0.14.0

### Minor Changes

- 93fd1a5: Voyant Cloud is now the default email/SMS/verify/vault provider for templates. Resend/Twilio adapters and auto-provider-resolution have been removed from `@voyantjs/notifications`; templates wire `@voyantjs/voyant-cloud` directly.

  **New packages:**

  - `@voyantjs/voyant-cloud` — `getVoyantCloudClient(env)` (throws when `VOYANT_CLOUD_API_KEY` is missing) and `tryGetVoyantCloudClient(env)` (returns `null`). Wraps `@voyantjs/cloud-sdk`.
  - `@voyantjs/verify` — `VerifyProvider` interface (`start` / `check`) plus `createVoyantCloudVerifyProvider({ client })` and `createLocalVerifyProvider()` for dev. `createVerifyService(provider)` is a thin wrapper.
  - `@voyantjs/vault` — `VaultProvider` interface (`getSecret(slug, key)`) plus `createVoyantCloudVaultProvider({ client })` and `createEnvVaultProvider({ env, resolveEnvKey? })` for self-hosters. `createVaultService(provider)` adds `(slug,key)` caching and `requireSecret`.

  **Breaking changes — `@voyantjs/notifications`:**

  - Removed `createResendProvider`, `createTwilioProvider`, `createDefaultNotificationProviders`, `createResendProviderFromEnv`, `createTwilioProviderFromEnv`. Removed sub-paths `./providers/resend`, `./providers/twilio`, `./provider-resolution`. The `local` provider stays for dev.
  - Added `createVoyantCloudEmailProvider({ client, from, replyTo? })` and `createVoyantCloudSmsProvider({ client, from? })` (sub-paths `./providers/voyant-cloud-email`, `./providers/voyant-cloud-sms`).
  - `buildNotificationTaskRuntime(env, options)` now throws when neither `providers` nor `resolveProviders` is supplied — there are no built-in defaults.

  **Breaking change — `@voyantjs/plugin-netopia`:**

  - `buildNetopiaNotificationRuntime` now throws `NetopiaNotificationRuntimeError` when neither `resolveNotificationProviders` nor `notificationProviders` is supplied. Templates must inject providers explicitly.

  **Migration for self-hosters who want raw Resend/Twilio:** implement `NotificationProvider` against your transport of choice and register it in your template's `src/lib/notifications.ts`. The interface is unchanged and remains the public extension point.

### Patch Changes

- Updated dependencies [93fd1a5]
  - @voyantjs/checkout@0.14.0
  - @voyantjs/core@0.14.0
  - @voyantjs/finance@0.14.0
  - @voyantjs/hono@0.14.0
  - @voyantjs/notifications@0.14.0

## 0.13.0

### Patch Changes

- @voyantjs/checkout@0.13.0
- @voyantjs/core@0.13.0
- @voyantjs/finance@0.13.0
- @voyantjs/hono@0.13.0
- @voyantjs/notifications@0.13.0

## 0.12.0

### Patch Changes

- @voyantjs/checkout@0.12.0
- @voyantjs/core@0.12.0
- @voyantjs/finance@0.12.0
- @voyantjs/hono@0.12.0
- @voyantjs/notifications@0.12.0

## 0.11.0

### Patch Changes

- @voyantjs/checkout@0.11.0
- @voyantjs/core@0.11.0
- @voyantjs/finance@0.11.0
- @voyantjs/hono@0.11.0
- @voyantjs/notifications@0.11.0

## 0.10.0

### Patch Changes

- Updated dependencies [29a581a]
- Updated dependencies [29a581a]
- Updated dependencies [b7f0501]
  - @voyantjs/checkout@0.10.0
  - @voyantjs/core@0.10.0
  - @voyantjs/finance@0.10.0
  - @voyantjs/hono@0.10.0
  - @voyantjs/notifications@0.10.0

## 0.9.0

### Patch Changes

- @voyantjs/checkout@0.9.0
- @voyantjs/core@0.9.0
- @voyantjs/finance@0.9.0
- @voyantjs/hono@0.9.0
- @voyantjs/notifications@0.9.0

## 0.8.0

### Patch Changes

- @voyantjs/checkout@0.8.0
- @voyantjs/core@0.8.0
- @voyantjs/finance@0.8.0
- @voyantjs/hono@0.8.0
- @voyantjs/notifications@0.8.0

## 0.7.0

### Patch Changes

- Updated dependencies [96612b3]
  - @voyantjs/checkout@0.7.0
  - @voyantjs/core@0.7.0
  - @voyantjs/finance@0.7.0
  - @voyantjs/hono@0.7.0
  - @voyantjs/notifications@0.7.0

## 0.6.9

### Patch Changes

- @voyantjs/checkout@0.6.9
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
  - @voyantjs/checkout@0.6.8
  - @voyantjs/core@0.6.8
  - @voyantjs/finance@0.6.8
  - @voyantjs/hono@0.6.8
  - @voyantjs/notifications@0.6.8

## 0.6.7

### Patch Changes

- @voyantjs/checkout@0.6.7
- @voyantjs/core@0.6.7
- @voyantjs/finance@0.6.7
- @voyantjs/hono@0.6.7
- @voyantjs/notifications@0.6.7

## 0.6.6

### Patch Changes

- @voyantjs/checkout@0.6.6
- @voyantjs/core@0.6.6
- @voyantjs/finance@0.6.6
- @voyantjs/hono@0.6.6
- @voyantjs/notifications@0.6.6

## 0.6.5

### Patch Changes

- @voyantjs/checkout@0.6.5
- @voyantjs/core@0.6.5
- @voyantjs/finance@0.6.5
- @voyantjs/hono@0.6.5
- @voyantjs/notifications@0.6.5

## 0.6.4

### Patch Changes

- @voyantjs/checkout@0.6.4
- @voyantjs/core@0.6.4
- @voyantjs/finance@0.6.4
- @voyantjs/hono@0.6.4
- @voyantjs/notifications@0.6.4

## 0.6.3

### Patch Changes

- Updated dependencies [93d3734]
- Updated dependencies [d3c6937]
  - @voyantjs/checkout@0.6.3
  - @voyantjs/core@0.6.3
  - @voyantjs/finance@0.6.3
  - @voyantjs/hono@0.6.3
  - @voyantjs/notifications@0.6.3

## 0.6.2

### Patch Changes

- @voyantjs/checkout@0.6.2
- @voyantjs/core@0.6.2
- @voyantjs/finance@0.6.2
- @voyantjs/hono@0.6.2
- @voyantjs/notifications@0.6.2

## 0.6.1

### Patch Changes

- @voyantjs/checkout@0.6.1
- @voyantjs/core@0.6.1
- @voyantjs/finance@0.6.1
- @voyantjs/hono@0.6.1
- @voyantjs/notifications@0.6.1

## 0.6.0

### Patch Changes

- @voyantjs/checkout@0.6.0
- @voyantjs/core@0.6.0
- @voyantjs/finance@0.6.0
- @voyantjs/hono@0.6.0
- @voyantjs/notifications@0.6.0

## 0.5.0

### Patch Changes

- @voyantjs/checkout@0.5.0
- @voyantjs/core@0.5.0
- @voyantjs/finance@0.5.0
- @voyantjs/hono@0.5.0
- @voyantjs/notifications@0.5.0

## 0.4.5

### Patch Changes

- Updated dependencies [e3f6e72]
  - @voyantjs/checkout@0.4.5
  - @voyantjs/core@0.4.5
  - @voyantjs/finance@0.4.5
  - @voyantjs/hono@0.4.5
  - @voyantjs/notifications@0.4.5

## 0.4.4

### Patch Changes

- Updated dependencies [9349604]
  - @voyantjs/checkout@0.4.4
  - @voyantjs/core@0.4.4
  - @voyantjs/finance@0.4.4
  - @voyantjs/hono@0.4.4
  - @voyantjs/notifications@0.4.4

## 0.4.3

### Patch Changes

- Updated dependencies [02119e0]
  - @voyantjs/checkout@0.4.3
  - @voyantjs/core@0.4.3
  - @voyantjs/finance@0.4.3
  - @voyantjs/hono@0.4.3
  - @voyantjs/notifications@0.4.3

## 0.4.2

### Patch Changes

- Updated dependencies [8de4602]
  - @voyantjs/checkout@0.4.2
  - @voyantjs/core@0.4.2
  - @voyantjs/finance@0.4.2
  - @voyantjs/hono@0.4.2
  - @voyantjs/notifications@0.4.2

## 0.4.1

### Patch Changes

- Updated dependencies [a49630a]
  - @voyantjs/checkout@0.4.1
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

- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
  - @voyantjs/checkout@0.4.0
  - @voyantjs/core@0.4.0
  - @voyantjs/finance@0.4.0
  - @voyantjs/hono@0.4.0
  - @voyantjs/notifications@0.4.0

## 0.3.1

### Patch Changes

- Updated dependencies [8566f2d]
- Updated dependencies [8566f2d]
- Updated dependencies [8566f2d]
  - @voyantjs/core@0.3.1
  - @voyantjs/finance@0.3.1
  - @voyantjs/hono@0.3.1
  - @voyantjs/notifications@0.3.1

## 0.3.0

### Patch Changes

- @voyantjs/core@0.3.0
- @voyantjs/finance@0.3.0
- @voyantjs/hono@0.3.0
- @voyantjs/notifications@0.3.0

## 0.2.0

### Patch Changes

- 99c6dac: Fix the published package layout so plugin build output lands at `dist/*` without leaking `dist/src/*` or compiled tests into npm tarballs.
  - @voyantjs/core@0.2.0
  - @voyantjs/finance@0.2.0
  - @voyantjs/hono@0.2.0
  - @voyantjs/notifications@0.2.0

## 0.1.1

### Patch Changes

- @voyantjs/core@0.1.1
- @voyantjs/finance@0.1.1
- @voyantjs/hono@0.1.1
- @voyantjs/notifications@0.1.1
