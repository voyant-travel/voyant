---
"@voyantjs/checkout-react": minor
"@voyantjs/checkout-ui": minor
"@voyantjs/finance": patch
"@voyantjs/finance-react": minor
"@voyantjs/finance-ui": minor
---

Split "Collect payment" from "Generate payment link"; fix payment-schedule create; unblock admin-shared `/pay/:sessionId` links.

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
