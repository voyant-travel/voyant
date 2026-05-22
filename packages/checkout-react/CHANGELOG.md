# @voyantjs/checkout-react

## 0.64.1

### Patch Changes

- 572dde4: Add configurable customer-facing payment-link base URLs for generated links and notification template context.
- Updated dependencies [572dde4]
  - @voyantjs/checkout@0.64.1
  - @voyantjs/finance@0.64.1
  - @voyantjs/finance-react@0.64.1
  - @voyantjs/react@0.64.1

## 0.64.0

### Patch Changes

- Updated dependencies [6d0c8f3]
  - @voyantjs/checkout@0.64.0
  - @voyantjs/finance@0.64.0
  - @voyantjs/finance-react@0.64.0
  - @voyantjs/react@0.64.0

## 0.63.1

### Patch Changes

- @voyantjs/checkout@0.63.1
- @voyantjs/finance@0.63.1
- @voyantjs/finance-react@0.63.1
- @voyantjs/react@0.63.1

## 0.63.0

### Minor Changes

- 5bff9c3: Split "Collect payment" from "Generate payment link"; fix payment-schedule create; unblock admin-shared `/pay/:sessionId` links.

  `@voyantjs/finance-ui`

  - New `RecordBookingPaymentDialog` — bookkeeping flow for a payment that already happened (bank transfer, cash, cheque, manual card). Fetches the booking's open invoices via `useInvoices({ bookingId })`, auto-picks the only outstanding one, pre-fills amount with `balanceDueCents`. Fields: invoice picker, amount, payment date, status, method (full backend enum), reference, notes. POSTs via `useInvoicePaymentMutation`. New i18n group `recordBookingPaymentDialog` in EN + RO.
  - New `BookingInvoiceSheet` — slide-in (`@voyantjs/ui` `Sheet`) invoice creator scoped to a single booking. Pre-fills currency / subtotal / total from the booking and snapshots `personId` / `organizationId`. Auto-generates an invoice number. Reuses the existing `invoiceDialog.*` i18n keys.

  `@voyantjs/checkout-ui`

  - `CollectPaymentDialog` simplified: dropped the `<PaymentStep>` "pick a method" block and the `pickHold` validation — bookings are already on hold from creation, so the dialog goes straight from amount to "Generate link". Added a schedule picker above the amount input that fetches open `pending` / `due` schedules via `useBookingPaymentSchedules(bookingId)` and pre-fills the amount when a schedule is picked. Manual amount edit detaches from the picked schedule. Default title remains "Generate payment link". New i18n keys: `scheduleLabel`, `scheduleHelp`, `scheduleFullAmount` template, `scheduleTypeLabels` (deposit / installment / balance / hold / other) in EN + RO. Removed `validation.pickHold`.

  `@voyantjs/checkout-react`

  - `useCollectPayment` no longer issues `startProvider` for the `hold` choice. Processors (Netopia) require a real billing block at provider-start time which the admin doesn't have; the customer-facing `/pay/:sessionId` lazy-start endpoint owns provider start with synthesized placeholder billing. The admin path now only creates the payment session + plan, and the link works on first customer click.

  `@voyantjs/finance-react`

  - New canonical `paymentMethodSchema` (full 9-value backend enum: `bank_transfer`, `credit_card`, `debit_card`, `cash`, `cheque`, `wallet`, `direct_bill`, `voucher`, `other`) and `paymentStatusSchema` (with `PaymentMethod` / `PaymentStatus` type exports) — mirrors `@voyantjs/finance/validation-shared` without dragging the server bundle into the browser.
  - `CreateInvoicePaymentInput.paymentMethod` / `status` reference the shared types (was a narrower hand-rolled union missing 4 methods).
  - `useBookingPaymentScheduleMutation` create/update fix: response schema was wrapping the already-enveloped server response, leaving every record field "undefined" to the parser and tripping a wall of Zod errors on success responses. Now uses `singleEnvelope(bookingPaymentScheduleRecordSchema)` like every other mutation hook.

  `@voyantjs/finance`

  - `GET /v1/public/finance/payment-sessions/:sessionId` no longer requires a `payment:read` capability when the session has a `bookingId`. The session id is the bearer credential (it's an opaque TypeID in a customer-shared link), and the public projection is already redacted to fields the customer already has. Brings booking-attached sessions to parity with trip sessions, which never had this requirement.

### Patch Changes

- Updated dependencies [5bff9c3]
  - @voyantjs/checkout@0.63.0
  - @voyantjs/finance@0.63.0
  - @voyantjs/finance-react@0.63.0
  - @voyantjs/react@0.63.0

## 0.62.3

### Patch Changes

- @voyantjs/checkout@0.62.3
- @voyantjs/finance@0.62.3
- @voyantjs/finance-react@0.62.3
- @voyantjs/react@0.62.3

## 0.62.2

### Patch Changes

- @voyantjs/checkout@0.62.2
- @voyantjs/finance@0.62.2
- @voyantjs/finance-react@0.62.2
- @voyantjs/react@0.62.2

## 0.62.1

### Patch Changes

- @voyantjs/checkout@0.62.1
- @voyantjs/finance@0.62.1
- @voyantjs/finance-react@0.62.1
- @voyantjs/react@0.62.1

## 0.62.0

### Patch Changes

- @voyantjs/checkout@0.62.0
- @voyantjs/finance@0.62.0
- @voyantjs/finance-react@0.62.0
- @voyantjs/react@0.62.0

## 0.61.0

### Patch Changes

- @voyantjs/checkout@0.61.0
- @voyantjs/finance@0.61.0
- @voyantjs/finance-react@0.61.0
- @voyantjs/react@0.61.0

## 0.60.0

### Patch Changes

- @voyantjs/checkout@0.60.0
- @voyantjs/finance@0.60.0
- @voyantjs/finance-react@0.60.0
- @voyantjs/react@0.60.0

## 0.59.0

### Patch Changes

- @voyantjs/checkout@0.59.0
- @voyantjs/finance@0.59.0
- @voyantjs/finance-react@0.59.0
- @voyantjs/react@0.59.0

## 0.58.0

### Patch Changes

- @voyantjs/checkout@0.58.0
- @voyantjs/finance@0.58.0
- @voyantjs/finance-react@0.58.0
- @voyantjs/react@0.58.0

## 0.57.0

### Patch Changes

- @voyantjs/checkout@0.57.0
- @voyantjs/finance@0.57.0
- @voyantjs/finance-react@0.57.0
- @voyantjs/react@0.57.0

## 0.56.0

### Patch Changes

- @voyantjs/checkout@0.56.0
- @voyantjs/finance@0.56.0
- @voyantjs/finance-react@0.56.0
- @voyantjs/react@0.56.0

## 0.55.1

### Patch Changes

- Updated dependencies [819c847]
  - @voyantjs/checkout@0.55.1
  - @voyantjs/finance@0.55.1
  - @voyantjs/finance-react@0.55.1
  - @voyantjs/react@0.55.1

## 0.55.0

### Patch Changes

- @voyantjs/checkout@0.55.0
- @voyantjs/finance@0.55.0
- @voyantjs/finance-react@0.55.0
- @voyantjs/react@0.55.0

## 0.54.0

### Patch Changes

- Updated dependencies [3117d27]
  - @voyantjs/checkout@0.54.0
  - @voyantjs/finance@0.54.0
  - @voyantjs/finance-react@0.54.0
  - @voyantjs/react@0.54.0

## 0.53.2

### Patch Changes

- @voyantjs/checkout@0.53.2
- @voyantjs/finance@0.53.2
- @voyantjs/finance-react@0.53.2
- @voyantjs/react@0.53.2

## 0.53.1

### Patch Changes

- @voyantjs/checkout@0.53.1
- @voyantjs/finance@0.53.1
- @voyantjs/finance-react@0.53.1
- @voyantjs/react@0.53.1

## 0.53.0

### Patch Changes

- @voyantjs/checkout@0.53.0
- @voyantjs/finance@0.53.0
- @voyantjs/finance-react@0.53.0
- @voyantjs/react@0.53.0

## 0.52.4

### Patch Changes

- @voyantjs/checkout@0.52.4
- @voyantjs/finance@0.52.4
- @voyantjs/finance-react@0.52.4
- @voyantjs/react@0.52.4

## 0.52.3

### Patch Changes

- Updated dependencies [9679a57]
  - @voyantjs/checkout@0.52.3
  - @voyantjs/finance@0.52.3
  - @voyantjs/finance-react@0.52.3
  - @voyantjs/react@0.52.3

## 0.52.2

### Patch Changes

- Updated dependencies [3e09123]
  - @voyantjs/checkout@0.52.2
  - @voyantjs/finance@0.52.2
  - @voyantjs/finance-react@0.52.2
  - @voyantjs/react@0.52.2

## 0.52.1

### Patch Changes

- @voyantjs/checkout@0.52.1
- @voyantjs/finance@0.52.1
- @voyantjs/finance-react@0.52.1
- @voyantjs/react@0.52.1

## 0.52.0

### Patch Changes

- @voyantjs/checkout@0.52.0
- @voyantjs/finance@0.52.0
- @voyantjs/finance-react@0.52.0
- @voyantjs/react@0.52.0

## 0.51.1

### Patch Changes

- @voyantjs/checkout@0.51.1
- @voyantjs/finance@0.51.1
- @voyantjs/finance-react@0.51.1
- @voyantjs/react@0.51.1

## 0.51.0

### Patch Changes

- @voyantjs/checkout@0.51.0
- @voyantjs/finance@0.51.0
- @voyantjs/finance-react@0.51.0
- @voyantjs/react@0.51.0

## 0.50.8

### Patch Changes

- @voyantjs/checkout@0.50.8
- @voyantjs/finance@0.50.8
- @voyantjs/finance-react@0.50.8
- @voyantjs/react@0.50.8

## 0.50.7

### Patch Changes

- @voyantjs/checkout@0.50.7
- @voyantjs/finance@0.50.7
- @voyantjs/finance-react@0.50.7
- @voyantjs/react@0.50.7

## 0.50.6

### Patch Changes

- Updated dependencies [c14f0a8]
  - @voyantjs/checkout@0.50.6
  - @voyantjs/finance@0.50.6
  - @voyantjs/finance-react@0.50.6
  - @voyantjs/react@0.50.6

## 0.50.5

### Patch Changes

- @voyantjs/checkout@0.50.5
- @voyantjs/finance@0.50.5
- @voyantjs/finance-react@0.50.5
- @voyantjs/react@0.50.5

## 0.50.4

### Patch Changes

- @voyantjs/checkout@0.50.4
- @voyantjs/finance@0.50.4
- @voyantjs/finance-react@0.50.4
- @voyantjs/react@0.50.4

## 0.50.3

### Patch Changes

- @voyantjs/checkout@0.50.3
- @voyantjs/finance@0.50.3
- @voyantjs/finance-react@0.50.3
- @voyantjs/react@0.50.3

## 0.50.2

### Patch Changes

- @voyantjs/checkout@0.50.2
- @voyantjs/finance@0.50.2
- @voyantjs/finance-react@0.50.2
- @voyantjs/react@0.50.2

## 0.50.1

### Patch Changes

- Updated dependencies [7b768c5]
  - @voyantjs/checkout@0.50.1
  - @voyantjs/finance@0.50.1
  - @voyantjs/finance-react@0.50.1
  - @voyantjs/react@0.50.1

## 0.50.0

### Patch Changes

- @voyantjs/checkout@0.50.0
- @voyantjs/finance@0.50.0
- @voyantjs/finance-react@0.50.0
- @voyantjs/react@0.50.0

## 0.49.0

### Patch Changes

- @voyantjs/checkout@0.49.0
- @voyantjs/finance@0.49.0
- @voyantjs/finance-react@0.49.0
- @voyantjs/react@0.49.0

## 0.48.0

### Patch Changes

- @voyantjs/checkout@0.48.0
- @voyantjs/finance@0.48.0
- @voyantjs/finance-react@0.48.0
- @voyantjs/react@0.48.0

## 0.47.0

### Patch Changes

- Updated dependencies [65408c6]
  - @voyantjs/checkout@0.47.0
  - @voyantjs/finance@0.47.0
  - @voyantjs/finance-react@0.47.0
  - @voyantjs/react@0.47.0

## 0.46.0

### Patch Changes

- @voyantjs/checkout@0.46.0
- @voyantjs/finance@0.46.0
- @voyantjs/finance-react@0.46.0
- @voyantjs/react@0.46.0

## 0.45.0

### Patch Changes

- @voyantjs/checkout@0.45.0
- @voyantjs/finance@0.45.0
- @voyantjs/finance-react@0.45.0
- @voyantjs/react@0.45.0

## 0.44.0

### Patch Changes

- @voyantjs/checkout@0.44.0
- @voyantjs/finance@0.44.0
- @voyantjs/finance-react@0.44.0
- @voyantjs/react@0.44.0

## 0.43.0

### Patch Changes

- @voyantjs/checkout@0.43.0
- @voyantjs/finance@0.43.0
- @voyantjs/finance-react@0.43.0
- @voyantjs/react@0.43.0

## 0.42.0

### Patch Changes

- Updated dependencies [786945f]
  - @voyantjs/checkout@0.42.0
  - @voyantjs/finance@0.42.0
  - @voyantjs/finance-react@0.42.0
  - @voyantjs/react@0.42.0

## 0.41.3

### Patch Changes

- @voyantjs/checkout@0.41.3
- @voyantjs/finance@0.41.3
- @voyantjs/finance-react@0.41.3
- @voyantjs/react@0.41.3

## 0.41.2

### Patch Changes

- @voyantjs/checkout@0.41.2
- @voyantjs/finance@0.41.2
- @voyantjs/finance-react@0.41.2
- @voyantjs/react@0.41.2

## 0.41.1

### Patch Changes

- @voyantjs/checkout@0.41.1
- @voyantjs/finance@0.41.1
- @voyantjs/finance-react@0.41.1
- @voyantjs/react@0.41.1

## 0.41.0

### Patch Changes

- @voyantjs/checkout@0.41.0
- @voyantjs/finance@0.41.0
- @voyantjs/finance-react@0.41.0
- @voyantjs/react@0.41.0

## 0.40.1

### Patch Changes

- @voyantjs/checkout@0.40.1
- @voyantjs/finance@0.40.1
- @voyantjs/finance-react@0.40.1
- @voyantjs/react@0.40.1

## 0.40.0

### Patch Changes

- @voyantjs/checkout@0.40.0
- @voyantjs/finance@0.40.0
- @voyantjs/finance-react@0.40.0
- @voyantjs/react@0.40.0

## 0.39.0

### Patch Changes

- Updated dependencies [2297949]
  - @voyantjs/checkout@0.39.0
  - @voyantjs/finance@0.39.0
  - @voyantjs/finance-react@0.39.0
  - @voyantjs/react@0.39.0

## 0.38.2

### Patch Changes

- @voyantjs/checkout@0.38.2
- @voyantjs/finance@0.38.2
- @voyantjs/finance-react@0.38.2
- @voyantjs/react@0.38.2

## 0.38.1

### Patch Changes

- @voyantjs/checkout@0.38.1
- @voyantjs/finance@0.38.1
- @voyantjs/finance-react@0.38.1
- @voyantjs/react@0.38.1

## 0.38.0

### Patch Changes

- @voyantjs/checkout@0.38.0
- @voyantjs/finance@0.38.0
- @voyantjs/finance-react@0.38.0
- @voyantjs/react@0.38.0

## 0.37.1

### Patch Changes

- @voyantjs/checkout@0.37.1
- @voyantjs/finance@0.37.1
- @voyantjs/finance-react@0.37.1
- @voyantjs/react@0.37.1

## 0.37.0

### Patch Changes

- Updated dependencies [dc29b79]
- Updated dependencies [a48660e]
- Updated dependencies [f014fd2]
  - @voyantjs/checkout@0.37.0
  - @voyantjs/finance@0.37.0
  - @voyantjs/finance-react@0.37.0
  - @voyantjs/react@0.37.0

## 0.36.0

### Patch Changes

- @voyantjs/checkout@0.36.0
- @voyantjs/finance@0.36.0
- @voyantjs/finance-react@0.36.0
- @voyantjs/react@0.36.0

## 0.35.0

### Patch Changes

- @voyantjs/checkout@0.35.0
- @voyantjs/finance@0.35.0
- @voyantjs/finance-react@0.35.0
- @voyantjs/react@0.35.0

## 0.34.0

### Patch Changes

- Updated dependencies [9095837]
  - @voyantjs/checkout@0.34.0
  - @voyantjs/finance@0.34.0
  - @voyantjs/finance-react@0.34.0
  - @voyantjs/react@0.34.0

## 0.33.1

### Patch Changes

- @voyantjs/checkout@0.33.1
- @voyantjs/finance@0.33.1
- @voyantjs/finance-react@0.33.1
- @voyantjs/react@0.33.1

## 0.33.0

### Patch Changes

- @voyantjs/checkout@0.33.0
- @voyantjs/finance@0.33.0
- @voyantjs/finance-react@0.33.0
- @voyantjs/react@0.33.0

## 0.32.3

### Patch Changes

- @voyantjs/checkout@0.32.3
- @voyantjs/finance@0.32.3
- @voyantjs/finance-react@0.32.3
- @voyantjs/react@0.32.3

## 0.32.2

### Patch Changes

- @voyantjs/checkout@0.32.2
- @voyantjs/finance@0.32.2
- @voyantjs/finance-react@0.32.2
- @voyantjs/react@0.32.2

## 0.32.1

### Patch Changes

- @voyantjs/checkout@0.32.1
- @voyantjs/finance@0.32.1
- @voyantjs/finance-react@0.32.1
- @voyantjs/react@0.32.1

## 0.32.0

### Patch Changes

- Updated dependencies [6ea6ded]
  - @voyantjs/checkout@0.32.0
  - @voyantjs/finance@0.32.0
  - @voyantjs/finance-react@0.32.0
  - @voyantjs/react@0.32.0

## 0.31.4

### Patch Changes

- @voyantjs/checkout@0.31.4
- @voyantjs/finance@0.31.4
- @voyantjs/finance-react@0.31.4
- @voyantjs/react@0.31.4

## 0.31.3

### Patch Changes

- Updated dependencies [5f974dd]
  - @voyantjs/checkout@0.31.3
  - @voyantjs/finance@0.31.3
  - @voyantjs/finance-react@0.31.3
  - @voyantjs/react@0.31.3

## 0.31.2

### Patch Changes

- @voyantjs/checkout@0.31.2
- @voyantjs/finance@0.31.2
- @voyantjs/finance-react@0.31.2
- @voyantjs/react@0.31.2

## 0.31.1

### Patch Changes

- @voyantjs/checkout@0.31.1
- @voyantjs/finance@0.31.1
- @voyantjs/finance-react@0.31.1
- @voyantjs/react@0.31.1

## 0.31.0

### Patch Changes

- @voyantjs/checkout@0.31.0
- @voyantjs/finance@0.31.0
- @voyantjs/finance-react@0.31.0
- @voyantjs/react@0.31.0

## 0.30.7

### Patch Changes

- @voyantjs/checkout@0.30.7
- @voyantjs/finance@0.30.7
- @voyantjs/finance-react@0.30.7
- @voyantjs/react@0.30.7

## 0.30.6

### Patch Changes

- @voyantjs/checkout@0.30.6
- @voyantjs/finance@0.30.6
- @voyantjs/finance-react@0.30.6
- @voyantjs/react@0.30.6

## 0.30.5

### Patch Changes

- @voyantjs/checkout@0.30.5
- @voyantjs/finance@0.30.5
- @voyantjs/finance-react@0.30.5
- @voyantjs/react@0.30.5

## 0.30.4

### Patch Changes

- @voyantjs/checkout@0.30.4
- @voyantjs/finance@0.30.4
- @voyantjs/finance-react@0.30.4
- @voyantjs/react@0.30.4

## 0.30.3

### Patch Changes

- @voyantjs/checkout@0.30.3
- @voyantjs/finance@0.30.3
- @voyantjs/finance-react@0.30.3
- @voyantjs/react@0.30.3

## 0.30.2

### Patch Changes

- @voyantjs/checkout@0.30.2
- @voyantjs/finance@0.30.2
- @voyantjs/finance-react@0.30.2
- @voyantjs/react@0.30.2

## 0.30.1

### Patch Changes

- @voyantjs/checkout@0.30.1
- @voyantjs/finance@0.30.1
- @voyantjs/finance-react@0.30.1
- @voyantjs/react@0.30.1

## 0.30.0

### Patch Changes

- @voyantjs/checkout@0.30.0
- @voyantjs/finance@0.30.0
- @voyantjs/finance-react@0.30.0
- @voyantjs/react@0.30.0

## 0.29.0

### Patch Changes

- Updated dependencies [4a6523e]
  - @voyantjs/checkout@0.29.0
  - @voyantjs/finance@0.29.0
  - @voyantjs/finance-react@0.29.0
  - @voyantjs/react@0.29.0

## 0.28.3

### Patch Changes

- Updated dependencies [60ef432]
  - @voyantjs/checkout@0.28.3
  - @voyantjs/finance@0.28.3
  - @voyantjs/finance-react@0.28.3
  - @voyantjs/react@0.28.3

## 0.28.2

### Patch Changes

- @voyantjs/checkout@0.28.2
- @voyantjs/finance@0.28.2
- @voyantjs/finance-react@0.28.2
- @voyantjs/react@0.28.2

## 0.28.1

### Patch Changes

- @voyantjs/checkout@0.28.1
- @voyantjs/finance@0.28.1
- @voyantjs/finance-react@0.28.1
- @voyantjs/react@0.28.1

## 0.28.0

### Patch Changes

- @voyantjs/checkout@0.28.0
- @voyantjs/finance@0.28.0
- @voyantjs/finance-react@0.28.0
- @voyantjs/react@0.28.0

## 0.27.0

### Patch Changes

- @voyantjs/checkout@0.27.0
- @voyantjs/finance@0.27.0
- @voyantjs/finance-react@0.27.0
- @voyantjs/react@0.27.0

## 0.26.9

### Patch Changes

- @voyantjs/checkout@0.26.9
- @voyantjs/finance@0.26.9
- @voyantjs/finance-react@0.26.9
- @voyantjs/react@0.26.9

## 0.26.8

### Patch Changes

- @voyantjs/checkout@0.26.8
- @voyantjs/finance@0.26.8
- @voyantjs/finance-react@0.26.8
- @voyantjs/react@0.26.8

## 0.26.7

### Patch Changes

- @voyantjs/checkout@0.26.7
- @voyantjs/finance@0.26.7
- @voyantjs/finance-react@0.26.7
- @voyantjs/react@0.26.7

## 0.26.6

### Patch Changes

- Updated dependencies [571e340]
  - @voyantjs/checkout@0.26.6
  - @voyantjs/finance@0.26.6
  - @voyantjs/finance-react@0.26.6
  - @voyantjs/react@0.26.6

## 0.26.5

### Patch Changes

- @voyantjs/checkout@0.26.5
- @voyantjs/finance@0.26.5
- @voyantjs/finance-react@0.26.5
- @voyantjs/react@0.26.5

## 0.26.4

### Patch Changes

- @voyantjs/checkout@0.26.4
- @voyantjs/finance@0.26.4
- @voyantjs/finance-react@0.26.4
- @voyantjs/react@0.26.4

## 0.26.3

### Patch Changes

- @voyantjs/checkout@0.26.3
- @voyantjs/finance@0.26.3
- @voyantjs/finance-react@0.26.3
- @voyantjs/react@0.26.3

## 0.26.2

### Patch Changes

- @voyantjs/checkout@0.26.2
- @voyantjs/finance@0.26.2
- @voyantjs/finance-react@0.26.2
- @voyantjs/react@0.26.2

## 0.26.1

### Patch Changes

- @voyantjs/checkout@0.26.1
- @voyantjs/finance@0.26.1
- @voyantjs/finance-react@0.26.1
- @voyantjs/react@0.26.1

## 0.26.0

### Patch Changes

- @voyantjs/checkout@0.26.0
- @voyantjs/finance@0.26.0
- @voyantjs/finance-react@0.26.0
- @voyantjs/react@0.26.0

## 0.25.0

### Patch Changes

- @voyantjs/checkout@0.25.0
- @voyantjs/finance@0.25.0
- @voyantjs/finance-react@0.25.0
- @voyantjs/react@0.25.0

## 0.24.3

### Patch Changes

- @voyantjs/checkout@0.24.3
- @voyantjs/finance@0.24.3
- @voyantjs/finance-react@0.24.3
- @voyantjs/react@0.24.3

## 0.24.2

### Patch Changes

- Updated dependencies [bec0471]
  - @voyantjs/checkout@0.24.2
  - @voyantjs/finance@0.24.2
  - @voyantjs/finance-react@0.24.2
  - @voyantjs/react@0.24.2

## 0.24.1

### Patch Changes

- @voyantjs/checkout@0.24.1
- @voyantjs/finance@0.24.1
- @voyantjs/finance-react@0.24.1
- @voyantjs/react@0.24.1

## 0.24.0

### Patch Changes

- @voyantjs/checkout@0.24.0
- @voyantjs/finance@0.24.0
- @voyantjs/finance-react@0.24.0
- @voyantjs/react@0.24.0

## 0.23.0

### Patch Changes

- @voyantjs/checkout@0.23.0
- @voyantjs/finance@0.23.0
- @voyantjs/finance-react@0.23.0
- @voyantjs/react@0.23.0

## 0.22.0

### Patch Changes

- @voyantjs/checkout@0.22.0
- @voyantjs/finance@0.22.0
- @voyantjs/finance-react@0.22.0
- @voyantjs/react@0.22.0

## 0.21.1

### Patch Changes

- @voyantjs/checkout@0.21.1
- @voyantjs/finance@0.21.1
- @voyantjs/finance-react@0.21.1
- @voyantjs/react@0.21.1

## 0.21.0

### Patch Changes

- Updated dependencies [6427bad]
  - @voyantjs/checkout@0.21.0
  - @voyantjs/finance@0.21.0
  - @voyantjs/finance-react@0.21.0
  - @voyantjs/react@0.21.0

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
  - @voyantjs/finance@0.20.0
  - @voyantjs/finance-react@0.20.0
  - @voyantjs/react@0.20.0
