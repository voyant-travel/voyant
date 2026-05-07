# @voyantjs/finance

## 0.26.6

### Patch Changes

- 571e340: Server-side dashboard aggregates: add `totalPax` and `upcomingDepartures.items` to `getBookingAggregates`, and `outstandingTopN` to `getFinanceAggregates` (closes #437).

  The operator dashboard previously sampled the first 100 bookings / invoices through the list endpoints and derived KPIs in the browser. With more than a handful of rows, "total pax", "upcoming departures", and "outstanding invoices" silently drifted from the truth.

  Bookings:

  - `BookingAggregates.totalPax` sums `pax` across active-status bookings in the requested range (cancelled excluded; null pax = 0).
  - `BookingAggregates.upcomingDepartures` is now `{ count, items }`. `items` is a bounded slice of soonest-departing bookings ordered by `start_date` asc, excluding cancelled and past departures. Bound via the new `upcomingLimit` query parameter (default 8, max 20).

  Finance:

  - `FinanceAggregates.outstandingTopN` returns the top-N outstanding invoices (`sent | partially_paid | overdue` with `balance_due_cents > 0`), ordered by `due_date` (nulls last), then `issue_date`, then `id`. Bound via the new `outstandingTopLimit` query parameter (default 5, max 20).

  The operator dashboard is rewired to consume these aggregates directly — KPI cards, the upcoming-departures list, and the "needs collection" panel are now exact rather than sample-derived. The dashboard also fixes a pre-existing bug where the outstanding panel summed `total_amount_cents` instead of `balance_due_cents`.

- Updated dependencies [571e340]
  - @voyantjs/bookings@0.26.6
  - @voyantjs/core@0.26.6
  - @voyantjs/db@0.26.6
  - @voyantjs/hono@0.26.6
  - @voyantjs/storage@0.26.6
  - @voyantjs/utils@0.26.6

## 0.26.5

### Patch Changes

- Updated dependencies [7a92aba]
  - @voyantjs/bookings@0.26.5
  - @voyantjs/core@0.26.5
  - @voyantjs/db@0.26.5
  - @voyantjs/hono@0.26.5
  - @voyantjs/storage@0.26.5
  - @voyantjs/utils@0.26.5

## 0.26.4

### Patch Changes

- Updated dependencies [6493f62]
  - @voyantjs/bookings@0.26.4
  - @voyantjs/core@0.26.4
  - @voyantjs/db@0.26.4
  - @voyantjs/hono@0.26.4
  - @voyantjs/storage@0.26.4
  - @voyantjs/utils@0.26.4

## 0.26.3

### Patch Changes

- Updated dependencies [372cad5]
  - @voyantjs/bookings@0.26.3
  - @voyantjs/core@0.26.3
  - @voyantjs/db@0.26.3
  - @voyantjs/hono@0.26.3
  - @voyantjs/storage@0.26.3
  - @voyantjs/utils@0.26.3

## 0.26.2

### Patch Changes

- Updated dependencies [ffdb485]
  - @voyantjs/bookings@0.26.2
  - @voyantjs/core@0.26.2
  - @voyantjs/db@0.26.2
  - @voyantjs/hono@0.26.2
  - @voyantjs/storage@0.26.2
  - @voyantjs/utils@0.26.2

## 0.26.1

### Patch Changes

- Updated dependencies [c0507a6]
  - @voyantjs/bookings@0.26.1
  - @voyantjs/core@0.26.1
  - @voyantjs/db@0.26.1
  - @voyantjs/hono@0.26.1
  - @voyantjs/storage@0.26.1
  - @voyantjs/utils@0.26.1

## 0.26.0

### Patch Changes

- @voyantjs/bookings@0.26.0
- @voyantjs/core@0.26.0
- @voyantjs/db@0.26.0
- @voyantjs/hono@0.26.0
- @voyantjs/storage@0.26.0
- @voyantjs/utils@0.26.0

## 0.25.0

### Patch Changes

- @voyantjs/bookings@0.25.0
- @voyantjs/core@0.25.0
- @voyantjs/db@0.25.0
- @voyantjs/hono@0.25.0
- @voyantjs/storage@0.25.0
- @voyantjs/utils@0.25.0

## 0.24.3

### Patch Changes

- @voyantjs/bookings@0.24.3
- @voyantjs/core@0.24.3
- @voyantjs/db@0.24.3
- @voyantjs/hono@0.24.3
- @voyantjs/storage@0.24.3
- @voyantjs/utils@0.24.3

## 0.24.2

### Patch Changes

- @voyantjs/bookings@0.24.2
- @voyantjs/core@0.24.2
- @voyantjs/db@0.24.2
- @voyantjs/hono@0.24.2
- @voyantjs/storage@0.24.2
- @voyantjs/utils@0.24.2

## 0.24.1

### Patch Changes

- @voyantjs/bookings@0.24.1
- @voyantjs/core@0.24.1
- @voyantjs/db@0.24.1
- @voyantjs/hono@0.24.1
- @voyantjs/storage@0.24.1
- @voyantjs/utils@0.24.1

## 0.24.0

### Patch Changes

- @voyantjs/bookings@0.24.0
- @voyantjs/core@0.24.0
- @voyantjs/db@0.24.0
- @voyantjs/hono@0.24.0
- @voyantjs/storage@0.24.0
- @voyantjs/utils@0.24.0

## 0.23.0

### Patch Changes

- @voyantjs/bookings@0.23.0
- @voyantjs/core@0.23.0
- @voyantjs/db@0.23.0
- @voyantjs/hono@0.23.0
- @voyantjs/storage@0.23.0
- @voyantjs/utils@0.23.0

## 0.22.0

### Patch Changes

- @voyantjs/bookings@0.22.0
- @voyantjs/core@0.22.0
- @voyantjs/db@0.22.0
- @voyantjs/hono@0.22.0
- @voyantjs/storage@0.22.0
- @voyantjs/utils@0.22.0

## 0.21.1

### Patch Changes

- @voyantjs/bookings@0.21.1
- @voyantjs/core@0.21.1
- @voyantjs/db@0.21.1
- @voyantjs/hono@0.21.1
- @voyantjs/storage@0.21.1
- @voyantjs/utils@0.21.1

## 0.21.0

### Minor Changes

- 6427bad: Release the booking journey architecture train.

  This adds booking hold policy support, richer traveler and booking journey flows, operator tax policy configuration, finance billing and tax policy APIs, notification reminder target and delivery tooling, and the template/runtime wiring needed for the operator storefront checkout flow.

### Patch Changes

- Updated dependencies [6427bad]
  - @voyantjs/bookings@0.21.0
  - @voyantjs/core@0.21.0
  - @voyantjs/db@0.21.0
  - @voyantjs/hono@0.21.0
  - @voyantjs/storage@0.21.0
  - @voyantjs/utils@0.21.0

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

- @voyantjs/bookings@0.20.0
- @voyantjs/core@0.20.0
- @voyantjs/db@0.20.0
- @voyantjs/hono@0.20.0
- @voyantjs/storage@0.20.0
- @voyantjs/utils@0.20.0

## 0.19.0

### Patch Changes

- Updated dependencies [714c544]
  - @voyantjs/bookings@0.19.0
  - @voyantjs/core@0.19.0
  - @voyantjs/db@0.19.0
  - @voyantjs/hono@0.19.0
  - @voyantjs/storage@0.19.0
  - @voyantjs/utils@0.19.0

## 0.18.0

### Patch Changes

- Updated dependencies [8932f60]
  - @voyantjs/bookings@0.18.0
  - @voyantjs/core@0.18.0
  - @voyantjs/db@0.18.0
  - @voyantjs/hono@0.18.0
  - @voyantjs/storage@0.18.0
  - @voyantjs/utils@0.18.0

## 0.17.0

### Patch Changes

- 66d722d: `financeService.completePaymentSession` now accepts a 4th `runtime: { eventBus? }` parameter and emits `invoice.settled` after the transaction commits when a payment is applied to an invoice. Closes a fan-out gap where plugin callbacks (Netopia and friends) had to either run a separate poller or wrap each provider callback to manually trigger `pollInvoiceSettlement`. The Netopia plugin's callback route now resolves the finance runtime from the container and threads the eventBus through `handleCallback`.

  Default callers (no runtime) remain unchanged. `pollInvoiceSettlement` continues to emit independently — no double-emit, since it goes through `createPayment`, not `completePaymentSession`.

- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
  - @voyantjs/bookings@0.17.0
  - @voyantjs/core@0.17.0
  - @voyantjs/db@0.17.0
  - @voyantjs/hono@0.17.0
  - @voyantjs/storage@0.17.0
  - @voyantjs/utils@0.17.0

## 0.16.0

### Patch Changes

- @voyantjs/bookings@0.16.0
- @voyantjs/core@0.16.0
- @voyantjs/db@0.16.0
- @voyantjs/hono@0.16.0
- @voyantjs/storage@0.16.0
- @voyantjs/utils@0.16.0

## 0.15.0

### Patch Changes

- @voyantjs/bookings@0.15.0
- @voyantjs/core@0.15.0
- @voyantjs/db@0.15.0
- @voyantjs/hono@0.15.0
- @voyantjs/storage@0.15.0
- @voyantjs/utils@0.15.0

## 0.14.0

### Patch Changes

- @voyantjs/bookings@0.14.0
- @voyantjs/core@0.14.0
- @voyantjs/db@0.14.0
- @voyantjs/hono@0.14.0
- @voyantjs/storage@0.14.0
- @voyantjs/utils@0.14.0

## 0.13.0

### Patch Changes

- Updated dependencies [7dfbc05]
- Updated dependencies [15dda79]
  - @voyantjs/bookings@0.13.0
  - @voyantjs/core@0.13.0
  - @voyantjs/db@0.13.0
  - @voyantjs/hono@0.13.0
  - @voyantjs/storage@0.13.0
  - @voyantjs/utils@0.13.0

## 0.12.0

### Patch Changes

- Updated dependencies [944d244]
- Updated dependencies [cc561ce]
  - @voyantjs/bookings@0.12.0
  - @voyantjs/core@0.12.0
  - @voyantjs/db@0.12.0
  - @voyantjs/hono@0.12.0
  - @voyantjs/storage@0.12.0
  - @voyantjs/utils@0.12.0

## 0.11.0

### Patch Changes

- Updated dependencies [fe905b0]
  - @voyantjs/bookings@0.11.0
  - @voyantjs/core@0.11.0
  - @voyantjs/db@0.11.0
  - @voyantjs/hono@0.11.0
  - @voyantjs/storage@0.11.0
  - @voyantjs/utils@0.11.0

## 0.10.0

### Patch Changes

- 29a581a: Add Postgres `CHECK` constraints across finance, bookings, and transactions schemas to enforce: if any `*_amount_cents` column is set, its companion currency column must also be set.

  Two flavours, depending on column shape:

  - **Strict XNOR** (`(currency IS NULL) = (amount IS NULL)`) — one currency to one amount: `booking_guarantees`, `booking_item_commissions`, `payments` (base).
  - **Implication** (`(amounts NULL) OR (currency NOT NULL)`) — one currency covering multiple amount columns: `bookings.base_currency`, `booking_items.cost_currency`, `offer_items.cost_currency`, `order_items.cost_currency`, `invoices.base_currency`.

  The implication form intentionally allows "currency without amount" because the currency may be pre-declared before line items roll up.

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
  - @voyantjs/db@0.10.0
  - @voyantjs/hono@0.10.0
  - @voyantjs/storage@0.10.0
  - @voyantjs/utils@0.10.0

## 0.9.0

### Patch Changes

- @voyantjs/bookings@0.9.0
- @voyantjs/core@0.9.0
- @voyantjs/db@0.9.0
- @voyantjs/hono@0.9.0
- @voyantjs/storage@0.9.0
- @voyantjs/utils@0.9.0

## 0.8.0

### Patch Changes

- Updated dependencies [24dc253]
  - @voyantjs/bookings@0.8.0
  - @voyantjs/core@0.8.0
  - @voyantjs/db@0.8.0
  - @voyantjs/hono@0.8.0
  - @voyantjs/storage@0.8.0
  - @voyantjs/utils@0.8.0

## 0.7.0

### Minor Changes

- 96612b3: Bookings-create composition surface (#223) and vouchers-as-first-class (#227) — the packages on the release train all move together, so this covers the batch.

  **Atomic booking create (#263, #264, #265, #266)**

  - `POST /v1/admin/bookings/quick-create` — one-shot endpoint that converts a product, inserts travelers + payment schedules, redeems a voucher, and creates/joins a `booking_group` inside a single DB transaction. `quickCreateBooking(db, input, { userId, runtime })` service in `@voyantjs/finance`; `useBookingQuickCreateMutation` in `@voyantjs/bookings-react`.
  - `POST /v1/admin/bookings/dual-create` — partaj flow: two bookings + one shared-room group, also atomic. `dualCreateBooking` service, `useBookingDualCreateMutation` hook.
  - `booking.quick-created` and `booking.dual-created` events emitted post-commit when a runtime eventBus is wired.
  - `QuickBookDialog` now mounts all nine picker sections (product, departure, rooms, person, shared-room, passengers, price breakdown, voucher, payment schedule) and submits via quick-create. Post-create "Confirm & notify traveler" toggle uses the new `useBookingStatusByIdMutation` to transition the fresh booking to `confirmed` — which (when `autoConfirmAndDispatch` is on) fires the doc bundle + traveler email through the existing `booking.confirmed` subscriber.
  - Bookings fix: `productDaysRef` / `getConvertProductData` now join through `product_itineraries` to match the real products schema; the existing `POST /v1/bookings/from-product` convert path works again.

  **Vouchers as first-class financial instruments (#262, #267)**

  - One-shot data migration: `migrateVouchersFromPaymentInstruments(db, opts)` in `@voyantjs/finance` (CLI wrapper `pnpm -F @voyantjs/finance migrate:vouchers`, `--dry-run` supported). Idempotent; pulls code, currency, amount, expiry from legacy JSONB metadata into the new `vouchers` table.
  - `vouchers.validFrom` (start-of-validity, maps to OpenTravel `Finance.Voucher.effectiveDate`) and `vouchers.seriesCode` (batch/campaign id, maps to `Finance.Voucher.seriesCode`) columns added. Redeem guard returns `voucher_not_started` when now < validFrom; the public `validateVoucher` `not_started` branch is now reachable. `seriesCode` exposed as a list filter. Migration pulls both from legacy metadata (honouring OpenTravel's `effectiveDate` alias).

### Patch Changes

- Updated dependencies [96612b3]
  - @voyantjs/bookings@0.7.0
  - @voyantjs/core@0.7.0
  - @voyantjs/db@0.7.0
  - @voyantjs/hono@0.7.0
  - @voyantjs/storage@0.7.0
  - @voyantjs/utils@0.7.0

## 0.6.9

### Patch Changes

- Updated dependencies [7619ef0]
  - @voyantjs/bookings@0.6.9
  - @voyantjs/core@0.6.9
  - @voyantjs/db@0.6.9
  - @voyantjs/hono@0.6.9
  - @voyantjs/storage@0.6.9
  - @voyantjs/utils@0.6.9

## 0.6.8

### Patch Changes

- b218885: Align finance child-list indexes with the existing parent-and-sort query shapes for booking payment schedules, guarantees, tax lines, commissions, invoice lines, payments, credit notes, credit note lines, finance notes, invoice renditions, and invoice external references.
- b218885: Align the remaining finance admin and document root-list indexes with their recency-sorted query shapes.
- b218885: Align finance payment root-list indexes with the current recency-sorted payment admin query shapes.
- Updated dependencies [b218885]
- Updated dependencies [b218885]
  - @voyantjs/bookings@0.6.8
  - @voyantjs/core@0.6.8
  - @voyantjs/db@0.6.8
  - @voyantjs/hono@0.6.8
  - @voyantjs/storage@0.6.8
  - @voyantjs/utils@0.6.8

## 0.6.7

### Patch Changes

- @voyantjs/bookings@0.6.7
- @voyantjs/core@0.6.7
- @voyantjs/db@0.6.7
- @voyantjs/hono@0.6.7
- @voyantjs/storage@0.6.7
- @voyantjs/utils@0.6.7

## 0.6.6

### Patch Changes

- @voyantjs/bookings@0.6.6
- @voyantjs/core@0.6.6
- @voyantjs/db@0.6.6
- @voyantjs/hono@0.6.6
- @voyantjs/storage@0.6.6
- @voyantjs/utils@0.6.6

## 0.6.5

### Patch Changes

- Updated dependencies [ae9933b]
  - @voyantjs/bookings@0.6.5
  - @voyantjs/core@0.6.5
  - @voyantjs/db@0.6.5
  - @voyantjs/hono@0.6.5
  - @voyantjs/storage@0.6.5
  - @voyantjs/utils@0.6.5

## 0.6.4

### Patch Changes

- @voyantjs/bookings@0.6.4
- @voyantjs/core@0.6.4
- @voyantjs/db@0.6.4
- @voyantjs/hono@0.6.4
- @voyantjs/storage@0.6.4
- @voyantjs/utils@0.6.4

## 0.6.3

### Patch Changes

- Updated dependencies [d3c6937]
  - @voyantjs/bookings@0.6.3
  - @voyantjs/core@0.6.3
  - @voyantjs/db@0.6.3
  - @voyantjs/hono@0.6.3
  - @voyantjs/storage@0.6.3
  - @voyantjs/utils@0.6.3

## 0.6.2

### Patch Changes

- @voyantjs/bookings@0.6.2
- @voyantjs/core@0.6.2
- @voyantjs/db@0.6.2
- @voyantjs/hono@0.6.2
- @voyantjs/storage@0.6.2
- @voyantjs/utils@0.6.2

## 0.6.1

### Patch Changes

- @voyantjs/bookings@0.6.1
- @voyantjs/core@0.6.1
- @voyantjs/db@0.6.1
- @voyantjs/hono@0.6.1
- @voyantjs/storage@0.6.1
- @voyantjs/utils@0.6.1

## 0.6.0

### Patch Changes

- @voyantjs/bookings@0.6.0
- @voyantjs/core@0.6.0
- @voyantjs/db@0.6.0
- @voyantjs/hono@0.6.0
- @voyantjs/storage@0.6.0
- @voyantjs/utils@0.6.0

## 0.5.0

### Patch Changes

- Updated dependencies [ce72e29]
  - @voyantjs/bookings@0.5.0
  - @voyantjs/core@0.5.0
  - @voyantjs/db@0.5.0
  - @voyantjs/hono@0.5.0
  - @voyantjs/storage@0.5.0
  - @voyantjs/utils@0.5.0

## 0.4.5

### Patch Changes

- e3f6e72: Standardize TypeID prefixes to a first-N-chars convention for better DX.

  Root entities now use the shortest unambiguous first-N chars of the entity name
  (e.g. `pers` instead of `prsn`, `org` instead of `orgn`). Child entities use a
  2-char module code plus 2-char suffix. 19 prefixes renamed in total.

- Updated dependencies [e3f6e72]
  - @voyantjs/bookings@0.4.5
  - @voyantjs/core@0.4.5
  - @voyantjs/db@0.4.5
  - @voyantjs/hono@0.4.5
  - @voyantjs/storage@0.4.5
  - @voyantjs/utils@0.4.5

## 0.4.4

### Patch Changes

- @voyantjs/bookings@0.4.4
- @voyantjs/core@0.4.4
- @voyantjs/db@0.4.4
- @voyantjs/hono@0.4.4
- @voyantjs/storage@0.4.4
- @voyantjs/utils@0.4.4

## 0.4.3

### Patch Changes

- @voyantjs/bookings@0.4.3
- @voyantjs/core@0.4.3
- @voyantjs/db@0.4.3
- @voyantjs/hono@0.4.3
- @voyantjs/storage@0.4.3
- @voyantjs/utils@0.4.3

## 0.4.2

### Patch Changes

- 8de4602: Add optional event-bus hooks around document primitives.

  - `@voyantjs/legal` contract document generation routes/services can now emit
    `contract.document.generated`
  - `@voyantjs/finance` invoice document generation can emit
    `invoice.document.generated`, and settlement reconciliation can emit
    `invoice.settled`
  - `@voyantjs/notifications` booking document sends can emit
    `booking.documents.sent`

  These stay at the primitive layer so apps can orchestrate their own document
  policies without Voyant owning the full workflow.

  - @voyantjs/bookings@0.4.2
  - @voyantjs/core@0.4.2
  - @voyantjs/db@0.4.2
  - @voyantjs/hono@0.4.2
  - @voyantjs/storage@0.4.2
  - @voyantjs/utils@0.4.2

## 0.4.1

### Patch Changes

- a49630a: Extend the public finance surface with customer-safe document lookup by reference
  and add typed organization member/invitation exports in `@voyantjs/auth-react`
  for shared team-management UIs.
- Updated dependencies [4c4ea3c]
  - @voyantjs/bookings@0.4.1
  - @voyantjs/core@0.4.1
  - @voyantjs/db@0.4.1
  - @voyantjs/hono@0.4.1
  - @voyantjs/storage@0.4.1
  - @voyantjs/utils@0.4.1

## 0.4.0

### Patch Changes

- e84fe0f: Add built-in PDF document adapters for legal and finance workflows.

  `@voyantjs/utils` now exports `renderPdfDocument()` as a shared basic PDF
  renderer for rendered text content. `@voyantjs/legal` and `@voyantjs/finance`
  now expose bundled PDF serializers and generator helpers on top of their
  storage-backed document workflows, so apps can generate readable PDF artifacts
  without wiring a custom browser renderer for the common case.

- e84fe0f: Add a first-class invoice and proforma document generation workflow.

  - add configurable admin routes for `generate-document` and
    `regenerate-document`
  - add `createFinanceHonoModule()` so apps can mount finance with an invoice
    document generator
  - generate ready `invoice_renditions` and mark prior renditions of the same
    format as `stale`
  - expose the new document-generation schemas and route factories from the
    package entrypoint

- e84fe0f: Add first-class invoice settlement polling and reconciliation.

  - add `POST /v1/admin/finance/invoices/:id/poll-settlement` with typed polling
    and reconciliation results
  - sync provider settlement state back onto `invoice_external_refs`
  - reconcile newly observed paid amounts into completed Voyant payments without
    over-applying across multiple provider refs
  - add `createSmartbillInvoiceSettlementPoller()` in
    `@voyantjs/plugin-smartbill`

- e84fe0f: Add a public booking payment-history route and matching React helpers so
  storefronts can read booking-scoped payments with invoice context from
  `/v1/public/finance/bookings/:bookingId/payments`.
- e84fe0f: Upgrade legal and finance template rendering to support Liquid-style control
  flow.

  - add a shared structured template renderer in `@voyantjs/utils`
  - keep simple `{{path}}` interpolation compatibility for existing templates
  - support Liquid loops, conditionals, and filters in legal and finance
    html/markdown templates
  - support Liquid rendering inside lexical text nodes for legal and finance
    template bodies

- e84fe0f: Add storage-backed document generator helpers for legal and finance workflows.

  `@voyantjs/legal` now exports `createStorageBackedContractDocumentGenerator()`
  and `defaultStorageBackedContractDocumentSerializer()` so rendered contract
  artifacts can be uploaded through Voyant storage providers without custom
  generator plumbing.

  `@voyantjs/finance` now exports
  `createStorageBackedInvoiceDocumentGenerator()` and
  `defaultStorageBackedInvoiceDocumentSerializer()` for the same workflow on
  invoice/proforma renditions, with built-in support for html/json/xml artifact
  uploads and explicit opt-in for custom PDF serializers.

- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [2d5f323]
- Updated dependencies [e84fe0f]
  - @voyantjs/bookings@0.4.0
  - @voyantjs/core@0.4.0
  - @voyantjs/db@0.4.0
  - @voyantjs/hono@0.4.0
  - @voyantjs/storage@0.4.0
  - @voyantjs/utils@0.4.0

## 0.3.1

### Patch Changes

- 8566f2d: Add a booking-scoped public finance document surface for invoice and proforma
  downloads.

  `@voyantjs/finance` now exposes a public booking documents route that returns
  customer-safe invoice and proforma document metadata, including the best
  available rendition status and download URL when a ready rendition has a public
  or signed URL. `@voyantjs/finance-react` now exposes matching schemas, query
  keys, query options, operations, and a `usePublicBookingDocuments` hook.

- 8566f2d: Republish the public storefront package surfaces so published tarballs match the
  current source tree. This release restores the public finance schemas needed by
  `@voyantjs/finance-react`, publishes the public booking and product service
  exports already present in source, and ships the day/version/media product React
  exports from the package root.
- Updated dependencies [8566f2d]
- Updated dependencies [8566f2d]
- Updated dependencies [8566f2d]
  - @voyantjs/bookings@0.3.1
  - @voyantjs/core@0.3.1
  - @voyantjs/db@0.3.1
  - @voyantjs/hono@0.3.1

## 0.3.0

### Patch Changes

- @voyantjs/bookings@0.3.0
- @voyantjs/core@0.3.0
- @voyantjs/db@0.3.0
- @voyantjs/hono@0.3.0

## 0.2.0

### Patch Changes

- @voyantjs/bookings@0.2.0
- @voyantjs/core@0.2.0
- @voyantjs/db@0.2.0
- @voyantjs/hono@0.2.0

## 0.1.1

### Patch Changes

- @voyantjs/bookings@0.1.1
- @voyantjs/core@0.1.1
- @voyantjs/db@0.1.1
- @voyantjs/hono@0.1.1
