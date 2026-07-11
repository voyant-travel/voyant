# Storefront checkout flow (operator starter)

End-to-end design for the operator starter's customer-facing checkout —
from the Review step in `<BookingJourney />` through contract acceptance,
payment, and the post-payment auto-generation of contract and invoice
documents. Modelled on the protravel-v3 reference implementation.

This document is the execution reference for that work. It describes
the target architecture, the gaps in the current Voyant codebase,
and the phased PR plan. Confirmed decisions live in the
"Decisions" section; open questions live in
"Decisions to confirm".

## Goal

Replace the storefront's current commit step with a flow that mirrors
how a real tour operator runs checkout:

1. User finishes the booking journey and clicks "Continue to checkout".
2. A contract preview dialog opens, prefilled from the draft. User
   ticks terms + marketing checkboxes and accepts.
3. A `/checkout/start` endpoint creates a booking in
   `awaiting_payment`, records the contract acceptance, and dispatches
   the `checkout-finalize` workflow with the chosen payment intent.
4. The flow branches by payment intent:
   - **Card** — Netopia redirect → 3DS → webhook resumes the
     workflow.
   - **Bank transfer** — proforma generated immediately via SmartBill,
     IBAN + payment reference shown to the customer; workflow waits
     for an admin to mark the payment as received.
   - **Inquiry** — no payment, no inventory hold; a CRM Quote is
     created for the operator to follow up.
5. Once payment is confirmed, the workflow:
   - transitions the booking to `confirmed`,
   - generates the contract PDF from the legal templates package,
   - generates the final invoice via the SmartBill plugin
     (converting the proforma when applicable),
   - notifies the customer with both documents attached.

The whole orchestration runs through Voyant workflows and executes in the
node-only workflow runtime. No Trigger.dev, no BullMQ.

## Reference: protravel-v3

Key files in `/Users/mihai/builds/clients/protravel-v3` we are
mirroring:

- `apps/site/src/components/booking/contract-modal.tsx` — full-screen
  Dialog rendering Liquid HTML with terms + marketing checkboxes.
- `apps/site/src/components/booking/booking-wizard/payment-handlers.ts`
  — `startCardPayment` (POST `/payments/start` → Netopia URL) and
  `startBankTransfer` (POST `/payments/bank/init` → IBAN + reference,
  immediate proforma).
- `apps/cms/src/engine/endpoints/payments/{start.ts, bank-init.ts,
  notify.ts}` — start, bank-init, and the Netopia webhook.
- `apps/cms/src/engine/hooks/payment-cascade.ts` — recomputes
  `paid / balanceDue / paymentStatus` after each payment write.
- `apps/cms/src/trigger/bookings/payment-status-changed.ts` — the
  task that fires on `unpaid → paid` and orchestrates contract +
  invoice generation.
- `apps/cms/src/trigger/billing/create-invoice.ts` — SmartBill
  invoice / proforma creation, FX-aware line items.

Per protravel, `proforma` is created on bank-transfer init; the
final `invoice` replaces it when payment lands. The proforma's
SmartBill ID is preserved via SmartBill's "convert proforma" API.

## Existing Voyant infrastructure to reuse

Confirmed during the planning exploration. Each item below is "code
that already exists and we wire into the new flow", not "code we
need to write".

| Area | Where | Surface we'll consume |
| --- | --- | --- |
| Booking engine | `packages/catalog/src/booking-engine/` | `bookEntity`, `quoteEntity`, `placeAvailabilityHold`, draft persistence |
| Bookings state machine | `packages/bookings/src/state-machine.ts` | `transitionBooking()`, status enum (we extend with `awaiting_payment`) |
| Legal contracts | `packages/legal/src/contracts/` | template render service, `contract_signatures` table, `autoGenerateContractOptions` |
| Finance | `packages/finance/src/` | `createInvoiceFromBooking`, invoice renditions, number series |
| SmartBill plugin | `@voyant-travel/plugin-smartbill` | graph-selected subscribers for `invoice.issued`, `invoice.proforma.issued`, `invoice.payment.recorded`; package admin sync route; `createSmartbillInvoiceSettlementPoller` |
| Netopia plugin | `@voyant-travel/plugin-netopia` | `startPaymentSession`, finance routes, webhook callback |
| EventBus | `packages/core/src/events.ts` | `emit / subscribe`, fire-and-forget |
| Workflows | `@voyant-travel/workflows` + Node workflow runtime | `createWorkflow`, `step`, async via JobRunner |
| Booking journey UI | `packages/bookings-react/src/journey/` | `<BookingJourney />`, descriptor-driven Review step, render-prop slots |

## Gaps to close

What is missing today and must be built. Each maps to a phase below.

1. **No contract preview before commit.** ReviewStep calls commit
   directly. We need a dialog that renders a contract template +
   collects acceptance.
2. **No `proforma` invoice type.** `invoices.invoiceType` only
   distinguishes status, not document kind. Bank-transfer flow needs
   a real proforma row that can later be converted to an invoice.
3. **Finance does not emit `invoice.issued`.** The SmartBill plugin
   subscribes but the emitter is missing on `createInvoiceFromBooking`.
4. **Netopia plugin is not wired into the booking surface.** It works
   for finance-plane payment sessions but the booking journey's
   commit path doesn't kick off a Netopia session.
5. **No bank-transfer instruction renderer + admin "mark paid"
   action.** Need both the customer-facing instructions screen and
   the operator-side "Mark payment received" button.
6. **No `awaiting_payment` booking status.** The current state set
   doesn't carry "money expected, hold active" semantics distinct
   from `on_hold` (which means staff brokering).
7. **No checkout workflow.** No `createWorkflow("checkout-finalize",
   ...)` definition. No `wait_for_event` step type in the workflows
   primitive (open question — see Decisions to confirm #4).

## Architecture

```
[BookingJourney] ── Review step
        │ user clicks "Continue to checkout"
        ▼
[ContractPreviewDialog]    ← renders contract template HTML, two checkboxes
        │ user accepts
        ▼
POST /v1/public/catalog/checkout/start
        │
        │ ┌─ creates booking (status=awaiting_payment)
        │ ├─ persists contract acceptance (legal.contract_signatures, method=electronic)
        │ ├─ commits availability hold (already done by bookEntity)
        │ └─ kicks off workflow "checkout-finalize" with paymentIntent
        ▼
   ┌────────────────┴──────────────────────────────┐
 card                                          bank_transfer / inquiry
   │                                                  │
ProductHandler.startPaymentSession(netopia)        startBankTransfer()
   → returns redirect URL                            → creates proforma immediately (smartbill)
   → 302 to Netopia                                  → emits invoice.proforma.issued
                                                     → returns IBAN/reference instructions
   │                                                  │
Netopia webhook → payment.completed event           Admin opens booking detail → "Mark payment received"
   │                                                  → emits payment.completed event
   └──────────────────┬───────────────────────────────┘
                      ▼
              [checkout-finalize workflow resumes]
                step: transitionBooking → confirmed
                step: generateContract  → renders + persists PDF
                step: generateInvoice   → createInvoiceFromBooking + emit invoice.issued
                                            → smartbill plugin syncs → SmartBill PDF
                step: notify            → buyer email (contract + invoice attached)
```

The workflow is the spine. Card and bank-transfer differ only in
**how the workflow gets unblocked**: a Netopia webhook for cards, an
admin click for bank transfers. `inquiry` short-circuits — no
payment session, no contract, just a CRM Quote for the operator's
queue.

## Implementation phases

Each phase is sized to land as one PR. Phases are ordered so each
can ship independently behind a feature flag without breaking the
existing operator dashboard's catalog-booking flow (which stays
unchanged).

### Phase 1 — Schema + state foundations

1. `packages/finance/src/schema.ts` — add `invoiceKind` enum
   `'invoice' | 'proforma' | 'credit_note'`. Add
   `convertedFromInvoiceId` self-FK so a proforma can become a final
   invoice. Migration backfills existing rows to `'invoice'`.
2. `packages/bookings/src/state-machine.ts` — add `awaiting_payment`
   status. Transitions: `draft → awaiting_payment`,
   `awaiting_payment → confirmed | cancelled | expired`. Add
   `paidAt` timestamp.
3. `packages/finance/src/service-create.ts` — emit `invoice.issued`
   and `invoice.proforma.issued` via the configured `EventBus` on
   creation.
4. `@voyant-travel/plugin-smartbill` — add proforma subscriber +
   `createProforma` client method.

### Phase 2 — Contract preview + acceptance

1. `packages/legal/src/contracts/routes-preview.ts` (new) — `POST
   /v1/{admin,public}/legal/contracts/preview`. Accepts
   `{ templateSlug | templateId, variables }`, returns rendered HTML.
   No persistence.
2. `packages/bookings-react/src/journey/components/contract-preview-dialog.tsx`
   (new) — full-screen `<Dialog>` with iframe/srcdoc rendering the
   HTML, two `<Checkbox>` controls (terms + marketing), Accept
   disabled until both are checked. Decline closes the dialog.
3. `packages/bookings-react/src/journey/components/journey-steps.tsx` —
   ReviewStep gets a "Continue to checkout" button that opens the
   dialog instead of calling commit directly.
4. `packages/bookings-react/src/journey/types.ts` — extend
   `BookingJourneyProps` with `contractTemplateSlug?: string` and
   `resolveContractVariables?: (draft) => Record<string, unknown>`.
   The storefront wrapper supplies a default that maps the draft to
   passenger / billing / room / dates.

### Phase 3 — Checkout-start endpoint + workflow definition

1. `starters/operator/src/api/catalog-checkout.ts` (new) — `POST
   /v1/public/catalog/checkout/start`. Calls `bookEntity` with
   status=`awaiting_payment`, records contract acceptance in
   `contract_signatures`, kicks off `checkout-finalize` with input
   `{ bookingId, paymentIntent, totals }`. Returns:
   - `card`: `{ redirectUrl }` (Netopia)
   - `bank_transfer`: `{ proformaId, instructions: { iban,
     beneficiary, reference, amount, dueAt } }`
   - `inquiry`: `{ inquiryId, status: "received" }`
2. `packages/catalog/src/booking-engine/workflows/checkout-finalize.ts`
   (new) — `createWorkflow("checkout-finalize", [...])`. Steps:
   - `wait_for_payment` (async, blocks until `payment.completed` for
     this booking; or timeout → `cancelled`)
   - `transition_to_confirmed` (sync)
   - `generate_contract` (sync)
   - `generate_invoice` (sync, type=`invoice`; if a proforma exists,
     convert via SmartBill)
   - `notify_customer` (async, via notifications package)
   - Compensations: release hold, void contract, void invoice on
     failures upstream of confirmation.
3. Node workflow runtime — register `checkout-finalize` so
   async execution works. The `wait_for_payment` step
   persists state and resumes when the matching `payment.completed`
   event arrives.

### Phase 4 — Card path (Netopia from booking surface)

1. `starters/operator/src/api/lib/payment-sessions.ts` (new) — thin
   helper that creates a `payment_sessions` row targeting the
   booking, then asks the Netopia plugin's `startPaymentSession` for
   the redirect URL.
2. `voyant-travel/plugin-netopia/src/service-callback.ts` — after
   `completePaymentSession`, emit `payment.completed` with
   `{ bookingId, paymentSessionId, amount, currency }`.
3. `starters/operator/src/components/voyant/booking-journey/storefront-booking-journey.tsx`
   — when `checkout-start` returns `{ redirectUrl }`,
   `window.location.assign(redirectUrl)`.
4. `shop_.confirmation.$bookingId.tsx` — flesh out the existing stub
   to poll `GET /v1/public/catalog/bookings/:id` until status →
   `confirmed`, then surface contract + invoice download links.

### Phase 5 — Bank-transfer path

1. `packages/finance/src/service-proforma.ts` (new) —
   `createProformaFromBooking(...)`. Mirrors
   `createInvoiceFromBooking` but emits
   `invoice.proforma.issued`.
2. Checkout-start endpoint (Phase 3) — for `bank_transfer`, generate
   proforma synchronously, return instructions from
   `capabilities.config.bankTransferDetails` (IBAN, beneficiary,
   reference = `BOOK-${bookingNumber}`).
3. `starters/operator/src/components/voyant/bookings/` — add a
   "Mark payment received" action on the booking detail page. Calls
   `POST /v1/admin/finance/payment-sessions/:id/mark-received`,
   which writes a payment row + emits `payment.completed`. The
   workflow resumes, generates the final invoice (the proforma's
   `convertedFromInvoiceId` links them).

### Phase 6 — Inquiry path + observability

1. Inquiry — `checkout-start` for intent=`inquiry` skips the
   workflow, writes a CRM Quote, emits `inquiry.created`.
   No contract, no invoice, no hold. The detail page on the operator
   side gets a "Convert to booking" action that re-enters the
   regular flow.
2. Operator dashboard — add a "Checkout pipeline" view showing
   bookings by workflow state (awaiting_payment / contract_pending /
   invoice_pending / completed).
3. Workflow-runs view — surface `workflow_runs` rows for the
   booking on the booking detail page so operators can see which
   step is in flight or stuck.

## Decisions to confirm

These are open at time of writing. Resolve before starting the
relevant phase.

1. **Booking status name** for "money expected, hold active":
   `awaiting_payment` (descriptive, recommended) vs reuse `on_hold`.
2. **Inquiry storage**: reuse `crm.quotes` (recommended — has
   stages and pipelines) vs new `inquiries` table.
3. **Contract acceptance signature storage**: write to
   `contract_signatures` with `method='electronic'` and capture
   `{ ip, userAgent, acceptedAt }` in the existing `signaturePayload`
   JSONB. Anything else regulatory-wise needed?
4. **Workflow durability** — does `core/workflows` support
   pausing on an event today? If not, we either build a
   `wait_for_event` step type or fall back to cron-polled resumption.
   Polling is uglier but works without changes.
5. **Netopia env keys** (`NETOPIA_MERCHANT_ID`, `NETOPIA_PRIVATE_KEY`,
   `NETOPIA_NOTIFY_URL`) — assumed already provisioned for the
   operator starter. Sandbox creds available?
6. **Proforma → invoice conversion**: use SmartBill RO's "convert
   proforma" call (preserves the proforma number) vs issuing a fresh
   invoice and crossing them in our DB. Cleaner to use SmartBill's
   conversion endpoint.
7. **Contract template seeding**: which slug does the demo
   `Demo · Reykjavík Northern Lights Hunt` use? Either seed a
   generic "tour-products" template or wire each product to a
   `contractTemplateSlug` in product detail.

## Risks

- **Workflow durability gap.** If `core/workflows` does not yet
  support pausing on an event, we either build it in or fall back to
  a polling approach (workflow re-fires on a cron and checks
  `bookings.status`). Polling is uglier but works today.
- **Netopia 3DS sandbox vs live.** Webhook URL must be publicly
  reachable. The operator dev port (3300) requires an ngrok-like
  tunnel for end-to-end testing; document this.
- **SmartBill rate limits + idempotency.** The `invoice.issued`
  subscriber must be idempotent — receiving the same event twice
  must not create two SmartBill docs. Use the booking number as the
  idempotency key and the SmartBill response cache.
- **Currency / FX.** Protravel handles cross-currency (RON-priced
  product, EUR payment). If the demo stays single-currency we can
  defer; mark explicit not-supported on the workflow until needed.
- **Cancellation race.** If the user closes the Netopia tab before
  paying, the hold should expire (existing reaper handles this) and
  the workflow should transition the booking to `cancelled`. Add a
  timeout step to `wait_for_payment` (e.g. 30 min for card, 5 days
  for bank transfer per protravel's pattern).
- **Backwards compat.** The existing operator dashboard's
  catalog-booking flow is operator-side and bypasses this checkout.
  We leave it alone for now and add the new flow on the storefront
  only — no regression risk.

## Implementation status

| Phase | Status | Commits |
| --- | --- | --- |
| 1.1 invoiceKind + convertedFromInvoiceId | ✅ done | aeb200611 |
| 1.2 awaiting_payment status + paidAt | ✅ done | aeb200611 |
| 1.3 finance emits invoice.issued / proforma.issued | ✅ done | aeb200611 |
| 1.4 SmartBill proforma subscriber | ✅ done | aeb200611 |
| 2 contract preview dialog + slug-based render endpoint | ✅ done | ba12d6a03 |
| 3 checkout-start endpoint + finalize workflow | ✅ done | e5d06d9c8, 6be800a4f |
| 4 Netopia card path | ✅ done | a556f0fac |
| 5 Bank-transfer path | ✅ done | a556f0fac |
| 6 Inquiry path + observability | ✅ done — workflow runs admin UI ships in `@voyant-travel/workflows-react/ui` |

What works end-to-end after Phase 5:

- The Review step opens the contract preview dialog with template
  variables mapped via `resolveContractVariables`. The Accept gate
  is the terms checkbox; marketing is optional.
- The storefront wrapper's default checkout handler:
  1. POSTs `/v1/public/catalog/book` with the draft → real booking id.
  2. POSTs `/v1/public/catalog/checkout/start` with the booking id +
     payment intent + acceptance.
  3. Routes the customer based on the response kind.
- `card` intent: creates a payment session targeting the booking,
  asks the Netopia plugin to start it, returns the redirect URL.
  Falls back to a confirmation-page poll when Netopia isn't
  configured (useful for demos without sandbox creds).
- `bank_transfer` intent: issues a proforma synchronously (which
  fires SmartBill's proforma subscriber via `invoice.proforma.issued`),
  creates a payment session targeting the booking, returns IBAN +
  reference instructions. The customer lands on a confirmation page
  that displays the instructions out of sessionStorage.
- The Netopia webhook → `completePaymentSession` → emits
  `payment.completed` → catalog-checkout bundle runs
  `checkout-finalize` → confirms the booking + issues the final
  invoice, with `convertedFromInvoiceId` linking it to the proforma
  when the bank-transfer path was used.
- Confirmation page: separate panels for `card_pending`,
  `bank_transfer`, `inquiry`, `hold`, and the default
  "booking confirmed" message.

Mark-payment-received (admin):

- The bank-transfer flow creates a payment session at checkout-start
  time. Operators mark it received via the existing
  `POST /v1/admin/finance/payment-sessions/:id/complete` endpoint
  with `{ status: "paid", captureMode: "manual", paymentMethod:
  "bank_transfer", ... }`. That fires `payment.completed` and the
  checkout-finalize workflow runs the same way the card path does.

Followups landed alongside Phase 6:

1. **Real CRM Quote for inquiry** ✅ — inquiry intent now
   creates a `crm.quotes` row using
   `INQUIRY_PIPELINE_ID`/`INQUIRY_STAGE_ID` env vars (or the first
   sales pipeline + stage when those aren't set), then cancels the
   booking so capacity isn't blocked. Emits `inquiry.created` for
   downstream subscribers. Falls back to the stub response only when
   no pipeline at all is configured in the deployment.
2. **Operator-side "Mark payment received" UI** ✅ — the booking
   detail's finance tab now renders a `BookingPendingPaymentSessions`
   card listing pending sessions for the booking with a one-click
   "Mark payment received" button that POSTs to
   `/v1/admin/finance/payment-sessions/:id/complete` and invalidates
   the surrounding booking + payments queries.
3. **Contract acceptance signature persistence** ✅ — the
   catalog-checkout bundle subscribes to `contract.document.generated`
   (fired after the legal package's auto-generate-contract creates
   the contract row); on each fire it reads the storefront's
   acceptance marker out of `bookings.internalNotes` and writes a
   real `contract_signatures` row via `contractsService.signContract`
   (`method: 'electronic'`). Idempotent — already-signed contracts
   are skipped.
4. **Booking status flip to `awaiting_payment`** ✅ — both card and
   bank-transfer paths transition the booking from `on_hold` →
   `awaiting_payment` at checkout-start so ops sees the right state
   while waiting on the webhook / manual mark-received.

### Observability (now landed)

`@voyant-travel/workflow-runs` is the lightweight observability layer
for in-process workflows. The catalog-checkout subscriber wraps the
`runCheckoutFinalize` call with a recorder that writes
`workflow_runs` + `workflow_run_steps` rows, tagged with the
booking id, payment session id, and payment intent. The
`WorkflowRunsPage` UI from `@voyant-travel/workflows-react/ui` reads
the admin routes (`/v1/admin/workflow-runs[/:id]`) the operator
starter mounts via `additionalRoutes`, and can be embedded in any
host or pointed at a separate-origin API via its `apiBase` option.

This observability sits beside the durable `@voyant-travel/workflows`
SDK + its `./selfhost` runtime. That stack remains the
right home for *durable* workflows (anything that needs persistence
across process restarts, fan-out, scheduling). The lightweight
recorder + SPA fill the gap for in-process sagas like
checkout-finalize that don't need that machinery.

## PR sequencing

1. Phase 1.1 + 1.2 — schema/state foundations.
2. Phase 1.3 + 1.4 — finance event emission + smartbill proforma
   subscriber.
3. Phase 2 — contract preview UI + endpoint.
4. Phase 3 — checkout endpoint + workflow definition (the integration
   moment; behind a feature flag on the storefront).
5. Phase 4 — Netopia card path.
6. Phase 5 — bank-transfer path.
7. Phase 6 — inquiry + observability.

Roughly seven PRs, deliverable in the same span of working days
assuming workflow durability is already in place. If `wait_for_event`
needs to be built, fold a Phase 3a in front of Phase 3.
