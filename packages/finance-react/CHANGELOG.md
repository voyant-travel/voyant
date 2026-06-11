# @voyantjs/finance-react

## 0.109.0

### Minor Changes

- 8638834: Packaged-admin RFC booking-detail close-out: the operator's last
  booking-detail wrappers move into the packages, backed by new client hooks
  for existing server endpoints. `@voyantjs/bookings-react` gains
  `useBookingActionLedger` (cursor-paged
  `GET /v1/admin/bookings/:id/action-ledger` feed with traveler labels) and
  `useBookingContractGenerationMutation` (preview + generate modes of
  `POST /v1/admin/bookings/:id/generate-contract`).
  `@voyantjs/finance-react` gains `usePaymentSessions`
  (`GET /v1/admin/finance/payment-sessions` with booking/status filters),
  `usePaymentSessionMutation` (`POST …/payment-sessions/:id/complete` and
  `/cancel`) and `useBookingPaymentScheduleRegenerateMutation`
  (`POST /v1/admin/bookings/:bookingId/payment-schedule/regenerate`), plus the
  matching payment-session / payment-policy schemas and
  `financeQueryKeys.paymentSessions*` keys.

  On top of those hooks, `@voyantjs/bookings-ui/admin` now owns the unified
  Documents tab (`BookingDocumentsTable` + `BookingContractDialog`, linking
  contract rows through a shape-locked `contract.detail` destination and the
  legal provider context's `baseUrl`) and merges the booking's central
  action-ledger entries into the Activity timeline natively
  (`useBookingActionLedgerEvents`); `BookingDetailHost` renders the Documents
  tab by default, exposes two new widget slots —
  `booking.details.finance-start` / `booking.details.finance-end`
  (`bookingDetailFinanceStartSlot` / `bookingDetailFinanceEndSlot`) — and
  forwards a new `onGenerateLink` host prop through
  `BookingDetailHostSlotContext`. `@voyantjs/finance-ui/admin` contributes the
  finance-tab cards onto those slots (RFC §4.7 cycle resolution, same as the
  invoices tab): `BookingPendingPaymentSessionsWidget` (pending payment links
  with copy/mark-received/cancel) and `BookingPaymentPolicyWidget` (cascade
  trace + booking-level override + schedule regenerate). The operator's
  booking-detail wrapper shrinks to the two payment dialogs
  (`CollectPaymentDialog` / `RecordBookingPaymentDialog`), which stay
  app-side because `@voyantjs/checkout-ui` / `@voyantjs/finance-ui` depend on
  `bookings-ui`; the dead `booking-catalog-source-card`,
  `booking-pricing-summary-card`, `booking-paid-payment-sessions` and
  `booking-note-dialog` wrappers are deleted.

### Patch Changes

- @voyantjs/finance@0.109.0

## 0.108.1

### Patch Changes

- Updated dependencies [92af490]
  - @voyantjs/finance@0.108.1

## 0.108.0

### Patch Changes

- @voyantjs/finance@0.108.0

## 0.107.1

### Patch Changes

- @voyantjs/finance@0.107.1

## 0.107.0

### Patch Changes

- @voyantjs/finance@0.107.0

## 0.106.7

### Patch Changes

- Updated dependencies [9c22b6b]
  - @voyantjs/finance@0.106.7

## 0.106.6

### Patch Changes

- Updated dependencies [b19888a]
  - @voyantjs/finance@0.106.6

## 0.106.5

### Patch Changes

- Updated dependencies [3198c8e]
  - @voyantjs/finance@0.106.5

## 0.106.4

### Patch Changes

- Updated dependencies [ee93be5]
  - @voyantjs/finance@0.106.4

## 0.106.3

### Patch Changes

- @voyantjs/finance@0.106.3

## 0.106.2

### Patch Changes

- Updated dependencies [83ff6fd]
  - @voyantjs/finance@0.106.2

## 0.106.1

### Patch Changes

- cfa6af8: feat(finance): accounts-payable supplier invoices, profitability & end-to-end FX

  Adds the full accounts-payable vertical for #1506:

  - **Supplier invoices (AP)**: `supplier_invoices` / `supplier_invoice_lines` /
    `supplier_cost_allocations`, the `supplierInvoicesService` (create/update/
    setLines/setAllocations/payments), attachments, and admin API routes.
  - **Cost allocation**: two-step product → departure picker, configurable cost
    categories (managed under Settings), searchable comboboxes.
  - **Profitability**: per-departure / per-product / per-traveller P&L read model
    - dashboards, cost-by-category breakdown, charts, CSV export.
  - **Accountant share portal**: scoped, revocable token links (no login) exposing
    financials + client/supplier invoices with downloadable attachments, ZIP
    download, and an en/ro language switcher.
  - **End-to-end FX**: supplier invoices and cost allocations snapshot their
    accounting-base value at the FX rate effective on the issue date; the
    profitability rollup sums those recorded snapshots (per-transaction-date
    rates) instead of re-valuing aggregates at the latest rate.

  Supporting additive exports: `availability`/`bookings`/`suppliers` schema and
  linkable exports consumed by the finance read model, and new TypeID prefixes in
  `schema-kit`.

- Updated dependencies [cfa6af8]
  - @voyantjs/finance@0.106.1

## 0.106.0

### Patch Changes

- @voyantjs/finance@0.106.0

## 0.105.0

### Patch Changes

- @voyantjs/finance@0.105.0

## 0.104.2

### Patch Changes

- Updated dependencies [75a6336]
  - @voyantjs/finance@0.104.2

## 0.104.1

### Patch Changes

- @voyantjs/finance@0.104.1
- @voyantjs/react@0.104.1

## 0.104.0

### Patch Changes

- @voyantjs/finance@0.104.0
- @voyantjs/react@0.104.0

## 0.103.0

### Patch Changes

- @voyantjs/finance@0.103.0
- @voyantjs/react@0.103.0

## 0.102.0

### Patch Changes

- @voyantjs/finance@0.102.0
- @voyantjs/react@0.102.0

## 0.101.2

### Patch Changes

- Updated dependencies [577eaf5]
  - @voyantjs/finance@0.101.2
  - @voyantjs/react@0.101.2

## 0.101.1

### Patch Changes

- @voyantjs/finance@0.101.1
- @voyantjs/react@0.101.1

## 0.101.0

### Patch Changes

- @voyantjs/finance@0.101.0
- @voyantjs/react@0.101.0

## 0.100.0

### Patch Changes

- @voyantjs/finance@0.100.0
- @voyantjs/react@0.100.0

## 0.99.0

### Patch Changes

- @voyantjs/finance@0.99.0
- @voyantjs/react@0.99.0

## 0.98.0

### Patch Changes

- @voyantjs/finance@0.98.0
- @voyantjs/react@0.98.0

## 0.97.0

### Patch Changes

- @voyantjs/finance@0.97.0
- @voyantjs/react@0.97.0

## 0.96.0

### Patch Changes

- @voyantjs/finance@0.96.0
- @voyantjs/react@0.96.0

## 0.95.0

### Patch Changes

- @voyantjs/finance@0.95.0
- @voyantjs/react@0.95.0

## 0.94.0

### Patch Changes

- @voyantjs/finance@0.94.0
- @voyantjs/react@0.94.0

## 0.93.0

### Patch Changes

- @voyantjs/finance@0.93.0
- @voyantjs/react@0.93.0

## 0.92.0

### Patch Changes

- @voyantjs/finance@0.92.0
- @voyantjs/react@0.92.0

## 0.91.0

### Patch Changes

- @voyantjs/finance@0.91.0
- @voyantjs/react@0.91.0

## 0.90.0

### Patch Changes

- @voyantjs/finance@0.90.0
- @voyantjs/react@0.90.0

## 0.89.0

### Patch Changes

- @voyantjs/finance@0.89.0
- @voyantjs/react@0.89.0

## 0.88.0

### Patch Changes

- @voyantjs/finance@0.88.0
- @voyantjs/react@0.88.0

## 0.87.1

### Patch Changes

- Updated dependencies [5be088f]
  - @voyantjs/finance@0.87.1
  - @voyantjs/react@0.87.1

## 0.87.0

### Patch Changes

- @voyantjs/finance@0.87.0
- @voyantjs/react@0.87.0

## 0.86.0

### Patch Changes

- @voyantjs/finance@0.86.0
- @voyantjs/react@0.86.0

## 0.85.4

### Patch Changes

- Updated dependencies [bed4a3f]
  - @voyantjs/finance@0.85.4
  - @voyantjs/react@0.85.4

## 0.85.3

### Patch Changes

- @voyantjs/finance@0.85.3
- @voyantjs/react@0.85.3

## 0.85.2

### Patch Changes

- @voyantjs/finance@0.85.2
- @voyantjs/react@0.85.2

## 0.85.1

### Patch Changes

- @voyantjs/finance@0.85.1
- @voyantjs/react@0.85.1

## 0.85.0

### Patch Changes

- @voyantjs/finance@0.85.0
- @voyantjs/react@0.85.0

## 0.84.4

### Patch Changes

- Updated dependencies [f3f8de1]
  - @voyantjs/finance@0.84.4
  - @voyantjs/react@0.84.4

## 0.84.3

### Patch Changes

- @voyantjs/finance@0.84.3
- @voyantjs/react@0.84.3

## 0.84.2

### Patch Changes

- @voyantjs/finance@0.84.2
- @voyantjs/react@0.84.2

## 0.84.1

### Patch Changes

- @voyantjs/finance@0.84.1
- @voyantjs/react@0.84.1

## 0.84.0

### Patch Changes

- Updated dependencies [4ea42b3]
  - @voyantjs/finance@0.84.0
  - @voyantjs/react@0.84.0

## 0.83.1

### Patch Changes

- @voyantjs/finance@0.83.1
- @voyantjs/react@0.83.1

## 0.83.0

### Patch Changes

- @voyantjs/finance@0.83.0
- @voyantjs/react@0.83.0

## 0.82.1

### Patch Changes

- @voyantjs/finance@0.82.1
- @voyantjs/react@0.82.1

## 0.82.0

### Patch Changes

- Updated dependencies [79ce168]
  - @voyantjs/finance@0.82.0
  - @voyantjs/react@0.82.0

## 0.81.21

### Patch Changes

- @voyantjs/finance@0.81.21
- @voyantjs/react@0.81.21

## 0.81.20

### Patch Changes

- @voyantjs/finance@0.81.20
- @voyantjs/react@0.81.20

## 0.81.19

### Patch Changes

- @voyantjs/finance@0.81.19
- @voyantjs/react@0.81.19

## 0.81.18

### Patch Changes

- @voyantjs/finance@0.81.18
- @voyantjs/react@0.81.18

## 0.81.17

### Patch Changes

- @voyantjs/finance@0.81.17
- @voyantjs/react@0.81.17

## 0.81.16

### Patch Changes

- 0a617cc: Operator-dashboard booking-detail UX polish + finance refactors.

  **Booking list & detail**

  - Bookings index hides `draft` + `expired` by default; new `excludeStatuses` filter on the bookings list endpoint + react query keys.
  - Booking-detail subtitle now shows `Billing person / Product / Dates / PAX` with clickable links to the CRM person, product, and availability slot; product title truncates at 18rem with full-text tooltip.
  - Header action menu replaced by inline outline buttons (Edit / Change status / Cancel / Delete). Delete uses a proper `AlertDialog` instead of `window.confirm`.
  - Stat-card currency layout is now `<symbol> <amount> <code>` for every currency except RON (collapses to `<amount> RON`).
  - Items table dates use the active locale (`formatDateTime` from i18n provider) and show start → end when both timestamps exist.
  - Tabs reordered: Documents now precedes Suppliers.

  **Tab refactors (Items / Travelers / Payments / Invoices / Documents / Suppliers / Payment-schedule)**

  - All seven tabs migrated off `<Card>` + raw `<table>` onto the shared `<div data-slot>` + `DataTable` + `IconActionButton` + `StatusBadge` + `AlertDialog` pattern.
  - Snapshots opened in a `<Sheet>` so operators stay on the booking page.

  **Invoices tab**

  - New `BookingInvoiceDialog` (Dialog, not Sheet) for "New Invoice": Type segmented (Invoice / Proforma), Source segmented (Schedule / Custom), schedule-driven prefill that auto-derives net unit amount, tax%, due date; manual line items with add/remove; auto-derived Subtotal/Tax/Total (always read-only); SmartBill sync toggle (defaults on); Mark as paid switch with method + date pickers; attachment uploader when sync is off; sandboxed iframe contract preview.
  - Generate-from-schedule line items now back the tax out of the gross schedule amount (no more 21% inflation on top).
  - Server omits `subtotalCents/taxCents/totalCents` cross-check when client doesn't pre-compute totals.

  **Add-contract dialog (new)**

  - `BookingContractDialog` replaces the per-row "Generate contract" button. Two modes — Generate (default, preselected) renders an iframe preview via a new `?preview=true` branch on `/v1/admin/bookings/:id/generate-contract`, and Upload (title + PDF) creates a `signed`-status contract row + attaches the file.
  - Legal `autoGenerateContractForBooking` gains a `previewMode` option that stops after rendering HTML without persisting.

  **Payment schedule**

  - Switched `PaymentScheduleValue` from fixed slots to a `installments: PaymentInstallment[]` array. Mode-switch prefills due dates between today and **one day before departure** (clamps to today when lead time ≤ 1 day) and distributes amounts evenly. Add/remove redistributes amounts so the rows always sum to the booking total.
  - New Invoice column on the schedule table links to the invoice/proforma covering each row.
  - Generate-invoice / Generate-proforma actions hide when an invoice (or proforma) already covers the row, preventing accidental duplicate documents.
  - Server-side `assertBookingPaymentScheduleHasPaymentCoverage` no longer requires session-linked payments — it sums every completed payment under the booking's invoices (with FX-equivalent amounts via `baseAmountCents`) and subtracts other schedules already paid, so manually-recorded payments can mark a schedule paid.
  - Schedule edit dialog now surfaces server validation errors inline instead of swallowing them.

  **Record payment dialog**

  - "Convert proforma to invoice" switch shown when the selected invoice is a proforma + status is Completed. Default off; auto-flips on only when the entered amount (directly or via FX) covers the invoice's remaining balance. Heuristic freezes once the operator toggles. Conversion fires post-create so a failure surfaces without rolling back the payment.
  - `useInvoicePaymentMutation` now invalidates the booking-scoped payment lists (`admin-booking-payments`) so the table refreshes after recording.

  **Proforma → invoice linkage**

  - `getInvoiceById` returns `convertedToInvoiceId` + `convertedToInvoiceNumber` (the inverse of `convertedFromInvoiceId`). The invoice sheet shows a green "Invoiced" / "Facturat" status with a deep link to the final invoice when a void proforma was converted. Converted proformas are filtered out of the invoices table on the booking detail page.

  **New booking dialog**

  - The three document-related checkboxes (Generate contract / Generate invoice / Create as draft) collapse into two mutually-exclusive options: "Generate proforma" and "Generate invoice and contract". `invoiceType` plumbs through the catalog booking-engine contract, products handler, finance service, and react hook.

  **Misc**

  - SmartBill plugin honors a new `skipExternalSync` flag on `invoice.issued` / `invoice.proforma.issued` so per-invoice opt-out from external sync is possible.
  - SmartBill rate-limit date parser now anchors `24/05/2026 09:32:48`-style timestamps to UTC instead of the JS host's local time. The instant decoded from the same response is now identical on CI (UTC) and on developer machines in non-UTC zones (e.g. Europe/Bucharest, EEST). Fixes a pre-existing test failure when running locally outside UTC.
  - Bookings list excludeStatuses filter (string-or-array) parsed by `bookingListQuerySchema`.
  - `BookingPaymentsSummary` adds an FX equivalent column with `baseCurrency` + `baseAmountCents` plumbed through `publicFinanceBookingPaymentSchema` and the operator `useAdminBookingPayments` projection.
  - Currency combobox now correctly disables (forwards `disabled` to the inner input and hides the clear button when disabled).
  - New shared primitives in `@voyantjs/bookings-ui`: `IconActionButton` (icon button with built-in tooltip) and `StatusBadge` (semantic tone mapping for status strings) — exported from the package root.

- Updated dependencies [0a617cc]
  - @voyantjs/finance@0.81.16
  - @voyantjs/react@0.81.16

## 0.81.15

### Patch Changes

- Updated dependencies [b6bc138]
  - @voyantjs/finance@0.81.15
  - @voyantjs/react@0.81.15

## 0.81.14

### Patch Changes

- Updated dependencies [0a77ff9]
  - @voyantjs/finance@0.81.14
  - @voyantjs/react@0.81.14

## 0.81.13

### Patch Changes

- @voyantjs/finance@0.81.13
- @voyantjs/react@0.81.13

## 0.81.12

### Patch Changes

- @voyantjs/finance@0.81.12
- @voyantjs/react@0.81.12

## 0.81.11

### Patch Changes

- Updated dependencies [ef079f4]
  - @voyantjs/finance@0.81.11
  - @voyantjs/react@0.81.11

## 0.81.10

### Patch Changes

- Updated dependencies [6c6a008]
  - @voyantjs/finance@0.81.10
  - @voyantjs/react@0.81.10

## 0.81.9

### Patch Changes

- Updated dependencies [1a58939]
  - @voyantjs/finance@0.81.9
  - @voyantjs/react@0.81.9

## 0.81.8

### Patch Changes

- @voyantjs/finance@0.81.8
- @voyantjs/react@0.81.8

## 0.81.7

### Patch Changes

- @voyantjs/finance@0.81.7
- @voyantjs/react@0.81.7

## 0.81.6

### Patch Changes

- @voyantjs/finance@0.81.6
- @voyantjs/react@0.81.6

## 0.81.5

### Patch Changes

- Updated dependencies [7d8a977]
  - @voyantjs/finance@0.81.5
  - @voyantjs/react@0.81.5

## 0.81.4

### Patch Changes

- Updated dependencies [6daefc4]
  - @voyantjs/finance@0.81.4
  - @voyantjs/react@0.81.4

## 0.81.3

### Patch Changes

- @voyantjs/finance@0.81.3
- @voyantjs/react@0.81.3

## 0.81.2

### Patch Changes

- @voyantjs/finance@0.81.2
- @voyantjs/react@0.81.2

## 0.81.1

### Patch Changes

- Updated dependencies [2ce08ff]
  - @voyantjs/finance@0.81.1
  - @voyantjs/react@0.81.1

## 0.81.0

### Patch Changes

- Updated dependencies [f35e63c]
  - @voyantjs/finance@0.81.0
  - @voyantjs/react@0.81.0

## 0.80.18

### Patch Changes

- @voyantjs/finance@0.80.18
- @voyantjs/react@0.80.18

## 0.80.17

### Patch Changes

- @voyantjs/finance@0.80.17
- @voyantjs/react@0.80.17

## 0.80.16

### Patch Changes

- dbcc0da: Add admin invoice voiding and route finance admin clients through `/v1/admin/finance`.
- Updated dependencies [dbcc0da]
  - @voyantjs/finance@0.80.16
  - @voyantjs/react@0.80.16

## 0.80.15

### Patch Changes

- @voyantjs/finance@0.80.15
- @voyantjs/react@0.80.15

## 0.80.14

### Patch Changes

- @voyantjs/finance@0.80.14
- @voyantjs/react@0.80.14

## 0.80.13

### Patch Changes

- Updated dependencies [55d99af]
  - @voyantjs/finance@0.80.13
  - @voyantjs/react@0.80.13

## 0.80.12

### Patch Changes

- 5070731: Add finance invoice number series admin UI and localize issue-document allocation errors.
  - @voyantjs/finance@0.80.12
  - @voyantjs/react@0.80.12

## 0.80.11

### Patch Changes

- @voyantjs/finance@0.80.11
- @voyantjs/react@0.80.11

## 0.80.10

### Patch Changes

- @voyantjs/finance@0.80.10
- @voyantjs/react@0.80.10

## 0.80.9

### Patch Changes

- @voyantjs/finance@0.80.9
- @voyantjs/react@0.80.9

## 0.80.8

### Patch Changes

- 6ba4515: Allow invoice-from-booking requests to pre-seed invoice external refs before issued events run.
- Updated dependencies [6ba4515]
  - @voyantjs/finance@0.80.8
  - @voyantjs/react@0.80.8

## 0.80.7

### Patch Changes

- e16eb2f: Allow invoice-from-booking requests to override invoice currency and line items while validating external fiscal totals.
- Updated dependencies [e16eb2f]
  - @voyantjs/finance@0.80.7
  - @voyantjs/react@0.80.7

## 0.80.6

### Patch Changes

- Updated dependencies [f7df51b]
  - @voyantjs/finance@0.80.6
  - @voyantjs/react@0.80.6

## 0.80.5

### Patch Changes

- Updated dependencies [f27b01f]
- Updated dependencies [d1ae342]
  - @voyantjs/finance@0.80.5
  - @voyantjs/react@0.80.5

## 0.80.4

### Patch Changes

- a411b1c: Use `@voyantjs/data-sdk` for the Voyant Data FX resolver and expose optional FX provenance fields.
- Updated dependencies [a411b1c]
  - @voyantjs/finance@0.80.4
  - @voyantjs/react@0.80.4

## 0.80.3

### Patch Changes

- Updated dependencies [6d816bb]
  - @voyantjs/finance@0.80.3
  - @voyantjs/react@0.80.3

## 0.80.2

### Patch Changes

- @voyantjs/finance@0.80.2
- @voyantjs/react@0.80.2

## 0.80.1

### Patch Changes

- @voyantjs/finance@0.80.1
- @voyantjs/react@0.80.1

## 0.80.0

### Patch Changes

- Updated dependencies [9473eb8]
  - @voyantjs/finance@0.80.0
  - @voyantjs/react@0.80.0

## 0.79.0

### Patch Changes

- @voyantjs/finance@0.79.0
- @voyantjs/react@0.79.0

## 0.78.0

### Patch Changes

- @voyantjs/finance@0.78.0
- @voyantjs/react@0.78.0

## 0.77.13

### Patch Changes

- Updated dependencies [70a32ab]
  - @voyantjs/finance@0.77.13
  - @voyantjs/react@0.77.13

## 0.77.12

### Patch Changes

- bf74cd4: Rename the invoice issuance status from `sent` to `issued`.
- Updated dependencies [bf74cd4]
  - @voyantjs/finance@0.77.12
  - @voyantjs/react@0.77.12

## 0.77.11

### Patch Changes

- Updated dependencies [437fb58]
  - @voyantjs/finance@0.77.11
  - @voyantjs/react@0.77.11

## 0.77.10

### Patch Changes

- 5751c4e: Let schedule-row invoice actions use server-side invoice number allocation and return conflicts for duplicate manual invoice numbers.
- Updated dependencies [5751c4e]
  - @voyantjs/finance@0.77.10
  - @voyantjs/react@0.77.10

## 0.77.9

### Patch Changes

- 10e3ed5: Create booking invoices from a targeted payment schedule row when one is provided.
- Updated dependencies [10e3ed5]
  - @voyantjs/finance@0.77.9
  - @voyantjs/react@0.77.9

## 0.77.8

### Patch Changes

- @voyantjs/finance@0.77.8
- @voyantjs/react@0.77.8

## 0.77.7

### Patch Changes

- @voyantjs/finance@0.77.7
- @voyantjs/react@0.77.7

## 0.77.6

### Patch Changes

- @voyantjs/finance@0.77.6
- @voyantjs/react@0.77.6

## 0.77.5

### Patch Changes

- Updated dependencies [6e522cb]
  - @voyantjs/finance@0.77.5
  - @voyantjs/react@0.77.5

## 0.77.4

### Patch Changes

- @voyantjs/finance@0.77.4
- @voyantjs/react@0.77.4

## 0.77.3

### Patch Changes

- @voyantjs/finance@0.77.3
- @voyantjs/react@0.77.3

## 0.77.2

### Patch Changes

- @voyantjs/finance@0.77.2
- @voyantjs/react@0.77.2

## 0.77.1

### Patch Changes

- Updated dependencies [574684d]
  - @voyantjs/finance@0.77.1
  - @voyantjs/react@0.77.1

## 0.77.0

### Patch Changes

- Updated dependencies [1da934d]
  - @voyantjs/finance@0.77.0
  - @voyantjs/react@0.77.0

## 0.76.0

### Patch Changes

- Updated dependencies [abf673d]
  - @voyantjs/finance@0.76.0
  - @voyantjs/react@0.76.0

## 0.75.7

### Patch Changes

- 827c25e: Allow invoice-from-booking calls to omit `invoiceNumber`, allocate numbers from active/default series, and hand external-provider series to SmartBill-style adapters for provider-owned numbering.
- Updated dependencies [827c25e]
  - @voyantjs/finance@0.75.7
  - @voyantjs/react@0.75.7

## 0.75.6

### Patch Changes

- @voyantjs/finance@0.75.6
- @voyantjs/react@0.75.6

## 0.75.5

### Patch Changes

- Updated dependencies [84a32bb]
- Updated dependencies [192c9aa]
  - @voyantjs/finance@0.75.5
  - @voyantjs/react@0.75.5

## 0.75.4

### Patch Changes

- @voyantjs/finance@0.75.4
- @voyantjs/react@0.75.4

## 0.75.3

### Patch Changes

- @voyantjs/finance@0.75.3
- @voyantjs/react@0.75.3

## 0.75.2

### Patch Changes

- @voyantjs/finance@0.75.2
- @voyantjs/react@0.75.2

## 0.75.1

### Patch Changes

- @voyantjs/finance@0.75.1
- @voyantjs/react@0.75.1

## 0.75.0

### Patch Changes

- @voyantjs/finance@0.75.0
- @voyantjs/react@0.75.0

## 0.74.2

### Patch Changes

- @voyantjs/finance@0.74.2
- @voyantjs/react@0.74.2

## 0.74.1

### Patch Changes

- 225a483: Auto-fill cross-currency booking payment FX rates from the configured Voyant Data FX resolver.
- Updated dependencies [225a483]
  - @voyantjs/finance@0.74.1
  - @voyantjs/react@0.74.1

## 0.74.0

### Patch Changes

- @voyantjs/finance@0.74.0
- @voyantjs/react@0.74.0

## 0.73.1

### Patch Changes

- @voyantjs/finance@0.73.1
- @voyantjs/react@0.73.1

## 0.73.0

### Patch Changes

- @voyantjs/finance@0.73.0
- @voyantjs/react@0.73.0

## 0.72.0

### Patch Changes

- @voyantjs/finance@0.72.0
- @voyantjs/react@0.72.0

## 0.71.0

### Patch Changes

- @voyantjs/finance@0.71.0
- @voyantjs/react@0.71.0

## 0.70.0

### Patch Changes

- @voyantjs/finance@0.70.0
- @voyantjs/react@0.70.0

## 0.69.1

### Patch Changes

- @voyantjs/finance@0.69.1
- @voyantjs/react@0.69.1

## 0.69.0

### Patch Changes

- @voyantjs/finance@0.69.0
- @voyantjs/react@0.69.0

## 0.68.0

### Patch Changes

- @voyantjs/finance@0.68.0
- @voyantjs/react@0.68.0

## 0.67.0

### Patch Changes

- @voyantjs/finance@0.67.0
- @voyantjs/react@0.67.0

## 0.66.6

### Patch Changes

- Updated dependencies [2a40d26]
  - @voyantjs/finance@0.66.6
  - @voyantjs/react@0.66.6

## 0.66.5

### Patch Changes

- @voyantjs/finance@0.66.5
- @voyantjs/react@0.66.5

## 0.66.4

### Patch Changes

- @voyantjs/finance@0.66.4
- @voyantjs/react@0.66.4

## 0.66.3

### Patch Changes

- @voyantjs/finance@0.66.3
- @voyantjs/react@0.66.3

## 0.66.2

### Patch Changes

- @voyantjs/finance@0.66.2
- @voyantjs/react@0.66.2

## 0.66.1

### Patch Changes

- @voyantjs/finance@0.66.1
- @voyantjs/react@0.66.1

## 0.66.0

### Patch Changes

- @voyantjs/finance@0.66.0
- @voyantjs/react@0.66.0

## 0.65.0

### Patch Changes

- @voyantjs/finance@0.65.0
- @voyantjs/react@0.65.0

## 0.64.1

### Patch Changes

- Updated dependencies [572dde4]
  - @voyantjs/finance@0.64.1
  - @voyantjs/react@0.64.1

## 0.64.0

### Patch Changes

- Updated dependencies [6d0c8f3]
  - @voyantjs/finance@0.64.0
  - @voyantjs/react@0.64.0

## 0.63.1

### Patch Changes

- @voyantjs/finance@0.63.1
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
  - @voyantjs/finance@0.63.0
  - @voyantjs/react@0.63.0

## 0.62.3

### Patch Changes

- @voyantjs/finance@0.62.3
- @voyantjs/react@0.62.3

## 0.62.2

### Patch Changes

- @voyantjs/finance@0.62.2
- @voyantjs/react@0.62.2

## 0.62.1

### Patch Changes

- @voyantjs/finance@0.62.1
- @voyantjs/react@0.62.1

## 0.62.0

### Patch Changes

- @voyantjs/finance@0.62.0
- @voyantjs/react@0.62.0

## 0.61.0

### Patch Changes

- @voyantjs/finance@0.61.0
- @voyantjs/react@0.61.0

## 0.60.0

### Patch Changes

- @voyantjs/finance@0.60.0
- @voyantjs/react@0.60.0

## 0.59.0

### Patch Changes

- @voyantjs/finance@0.59.0
- @voyantjs/react@0.59.0

## 0.58.0

### Patch Changes

- @voyantjs/finance@0.58.0
- @voyantjs/react@0.58.0

## 0.57.0

### Patch Changes

- @voyantjs/finance@0.57.0
- @voyantjs/react@0.57.0

## 0.56.0

### Patch Changes

- @voyantjs/finance@0.56.0
- @voyantjs/react@0.56.0

## 0.55.1

### Patch Changes

- Updated dependencies [819c847]
  - @voyantjs/finance@0.55.1
  - @voyantjs/react@0.55.1

## 0.55.0

### Patch Changes

- @voyantjs/finance@0.55.0
- @voyantjs/react@0.55.0

## 0.54.0

### Patch Changes

- Updated dependencies [3117d27]
  - @voyantjs/finance@0.54.0
  - @voyantjs/react@0.54.0

## 0.53.2

### Patch Changes

- @voyantjs/finance@0.53.2
- @voyantjs/react@0.53.2

## 0.53.1

### Patch Changes

- @voyantjs/finance@0.53.1
- @voyantjs/react@0.53.1

## 0.53.0

### Patch Changes

- @voyantjs/finance@0.53.0
- @voyantjs/react@0.53.0

## 0.52.4

### Patch Changes

- @voyantjs/finance@0.52.4
- @voyantjs/react@0.52.4

## 0.52.3

### Patch Changes

- 9679a57: Add the initial action ledger package with append-only ledger schemas, TypeID prefixes, canonical idempotency fingerprints, capability registry and guard helpers, query helpers, request-context ledger helpers, shared target timeline serialization, payload/relay append support, booking PII sensitive-read ledgering, booking traveler and travel-detail mutation ledgering, booking item/note/payment-policy mutation ledgering, booking action capability declarations and approval decision routing, booking action-ledger drift checks and dry-run remediation planning, finance invoice issuance/update/delete, invoice line-item ledgering, payment-session creation/update/lifecycle completion/failure/cancellation/expiration, payment instrument and authorization/capture ledgering, booking payment schedule and guarantee/default-plan ledgering, manual payment, supplier payment, and credit-note plus credit-note line-item ledgering, product create/update/delete ledgering with changed-field summaries and product timelines, nested product option, option-unit, translation, itinerary, day, day-service, media, brochure, feature, FAQ, location, taxonomy-link, destination-link, activation-setting, ticket-setting, visibility-setting, capability, and delivery-format mutation ledgering, product action-ledger drift checks, product admin route module splitting, admin list/detail routes with expanded filters and time windows plus payload and relay refs, relay outbox health listing with time windows and lifecycle helpers, runtime schema/route mounting, finance React client hooks for invoice and payment-session action ledger timelines, operator invoice/payment-session timeline mounting, product React client hooks and product detail activity UI, drift/canary health helpers and operator health endpoints, reversal recording support, route schema module split, client-safe React validation subpath imports, and reusable finance UI action ledger cards.
- Updated dependencies [9679a57]
  - @voyantjs/finance@0.52.3
  - @voyantjs/react@0.52.3

## 0.52.2

### Patch Changes

- 3e09123: Finance: tax-on-issue + invoice flow refresh.

  - `finance/service-issue.ts` is the new home for the invoice-issue pipeline: it computes line-level tax at issue time, snapshots the resolved tax regime onto the invoice, and emits the events expected by the SmartBill plugin.
  - `service-booking-create.ts` and `service.ts` route through the issue service so converting a booking to an invoice picks up the same tax/regime logic as a direct issue.
  - New route added to expose the tax-preview surface consumed by `useBookingTaxPreview`.
  - `useInvoiceMutation` refreshes the booking invoices/pricing caches after issue/void/refund so detail pages no longer go stale.
  - `PaymentsPage` styling and empty-state polish; new i18n strings for the issue/preview flow (EN + RO via `i18n/admin/finance`).

- Updated dependencies [3e09123]
  - @voyantjs/finance@0.52.2
  - @voyantjs/react@0.52.2

## 0.52.1

### Patch Changes

- @voyantjs/finance@0.52.1
- @voyantjs/react@0.52.1

## 0.52.0

### Patch Changes

- @voyantjs/finance@0.52.0
- @voyantjs/react@0.52.0

## 0.51.1

### Patch Changes

- @voyantjs/finance@0.51.1
- @voyantjs/react@0.51.1

## 0.51.0

### Patch Changes

- @voyantjs/finance@0.51.0
- @voyantjs/react@0.51.0

## 0.50.8

### Patch Changes

- @voyantjs/finance@0.50.8
- @voyantjs/react@0.50.8

## 0.50.7

### Patch Changes

- @voyantjs/finance@0.50.7
- @voyantjs/react@0.50.7

## 0.50.6

### Patch Changes

- Updated dependencies [c14f0a8]
  - @voyantjs/finance@0.50.6
  - @voyantjs/react@0.50.6

## 0.50.5

### Patch Changes

- @voyantjs/finance@0.50.5
- @voyantjs/react@0.50.5

## 0.50.4

### Patch Changes

- @voyantjs/finance@0.50.4
- @voyantjs/react@0.50.4

## 0.50.3

### Patch Changes

- @voyantjs/finance@0.50.3
- @voyantjs/react@0.50.3

## 0.50.2

### Patch Changes

- @voyantjs/finance@0.50.2
- @voyantjs/react@0.50.2

## 0.50.1

### Patch Changes

- Updated dependencies [7b768c5]
  - @voyantjs/finance@0.50.1
  - @voyantjs/react@0.50.1

## 0.50.0

### Patch Changes

- @voyantjs/finance@0.50.0
- @voyantjs/react@0.50.0

## 0.49.0

### Patch Changes

- @voyantjs/finance@0.49.0
- @voyantjs/react@0.49.0

## 0.48.0

### Patch Changes

- @voyantjs/finance@0.48.0
- @voyantjs/react@0.48.0

## 0.47.0

### Patch Changes

- Updated dependencies [65408c6]
  - @voyantjs/finance@0.47.0
  - @voyantjs/react@0.47.0

## 0.46.0

### Patch Changes

- @voyantjs/finance@0.46.0
- @voyantjs/react@0.46.0

## 0.45.0

### Patch Changes

- @voyantjs/finance@0.45.0
- @voyantjs/react@0.45.0

## 0.44.0

### Patch Changes

- @voyantjs/finance@0.44.0
- @voyantjs/react@0.44.0

## 0.43.0

### Patch Changes

- @voyantjs/finance@0.43.0
- @voyantjs/react@0.43.0

## 0.42.0

### Patch Changes

- Updated dependencies [786945f]
  - @voyantjs/finance@0.42.0
  - @voyantjs/react@0.42.0

## 0.41.3

### Patch Changes

- @voyantjs/finance@0.41.3
- @voyantjs/react@0.41.3

## 0.41.2

### Patch Changes

- @voyantjs/finance@0.41.2
- @voyantjs/react@0.41.2

## 0.41.1

### Patch Changes

- @voyantjs/finance@0.41.1
- @voyantjs/react@0.41.1

## 0.41.0

### Patch Changes

- @voyantjs/finance@0.41.0
- @voyantjs/react@0.41.0

## 0.40.1

### Patch Changes

- @voyantjs/finance@0.40.1
- @voyantjs/react@0.40.1

## 0.40.0

### Patch Changes

- @voyantjs/finance@0.40.0
- @voyantjs/react@0.40.0

## 0.39.0

### Patch Changes

- Updated dependencies [2297949]
  - @voyantjs/finance@0.39.0
  - @voyantjs/react@0.39.0

## 0.38.2

### Patch Changes

- @voyantjs/finance@0.38.2
- @voyantjs/react@0.38.2

## 0.38.1

### Patch Changes

- @voyantjs/finance@0.38.1
- @voyantjs/react@0.38.1

## 0.38.0

### Patch Changes

- @voyantjs/finance@0.38.0
- @voyantjs/react@0.38.0

## 0.37.1

### Patch Changes

- @voyantjs/finance@0.37.1
- @voyantjs/react@0.37.1

## 0.37.0

### Minor Changes

- a48660e: Add invoice bulk selection and a confirmable mark-paid action with partial-failure feedback.

### Patch Changes

- f014fd2: Capture manual base-currency settlement amounts for cross-currency customer and supplier payments, and settle invoice balances from the base invoice amount.
- Updated dependencies [dc29b79]
- Updated dependencies [f014fd2]
  - @voyantjs/finance@0.37.0
  - @voyantjs/react@0.37.0

## 0.36.0

### Patch Changes

- @voyantjs/finance@0.36.0
- @voyantjs/react@0.36.0

## 0.35.0

### Patch Changes

- @voyantjs/finance@0.35.0
- @voyantjs/react@0.35.0

## 0.34.0

### Patch Changes

- Updated dependencies [9095837]
  - @voyantjs/finance@0.34.0
  - @voyantjs/react@0.34.0

## 0.33.1

### Patch Changes

- @voyantjs/finance@0.33.1
- @voyantjs/react@0.33.1

## 0.33.0

### Patch Changes

- @voyantjs/finance@0.33.0
- @voyantjs/react@0.33.0

## 0.32.3

### Patch Changes

- @voyantjs/finance@0.32.3
- @voyantjs/react@0.32.3

## 0.32.2

### Patch Changes

- @voyantjs/finance@0.32.2
- @voyantjs/react@0.32.2

## 0.32.1

### Patch Changes

- @voyantjs/finance@0.32.1
- @voyantjs/react@0.32.1

## 0.32.0

### Patch Changes

- Updated dependencies [6ea6ded]
  - @voyantjs/finance@0.32.0
  - @voyantjs/react@0.32.0

## 0.31.4

### Patch Changes

- @voyantjs/finance@0.31.4
- @voyantjs/react@0.31.4

## 0.31.3

### Patch Changes

- 5f974dd: Add first-class invoice attachment persistence, admin routes, React hooks, and invoice detail UI.
- Updated dependencies [5f974dd]
  - @voyantjs/finance@0.31.3
  - @voyantjs/react@0.31.3

## 0.31.2

### Patch Changes

- @voyantjs/finance@0.31.2
- @voyantjs/react@0.31.2

## 0.31.1

### Patch Changes

- @voyantjs/finance@0.31.1
- @voyantjs/react@0.31.1

## 0.31.0

### Patch Changes

- @voyantjs/finance@0.31.0
- @voyantjs/react@0.31.0

## 0.30.7

### Patch Changes

- @voyantjs/finance@0.30.7
- @voyantjs/react@0.30.7

## 0.30.6

### Patch Changes

- @voyantjs/finance@0.30.6
- @voyantjs/react@0.30.6

## 0.30.5

### Patch Changes

- @voyantjs/finance@0.30.5
- @voyantjs/react@0.30.5

## 0.30.4

### Patch Changes

- @voyantjs/finance@0.30.4
- @voyantjs/react@0.30.4

## 0.30.3

### Patch Changes

- @voyantjs/finance@0.30.3
- @voyantjs/react@0.30.3

## 0.30.2

### Patch Changes

- @voyantjs/finance@0.30.2
- @voyantjs/react@0.30.2

## 0.30.1

### Patch Changes

- @voyantjs/finance@0.30.1
- @voyantjs/react@0.30.1

## 0.30.0

### Patch Changes

- @voyantjs/finance@0.30.0
- @voyantjs/react@0.30.0

## 0.29.0

### Patch Changes

- @voyantjs/finance@0.29.0
- @voyantjs/react@0.29.0

## 0.28.3

### Patch Changes

- 60ef432: Add a unified payments listing that joins customer and supplier payments into a single feed, and split the operator finance area into separate Invoices and Payments pages.

  `@voyantjs/finance`:

  - New routes `GET /v1/admin/finance/payments` and `GET /v1/admin/finance/payments/:id`. The list endpoint accepts a `kind` filter (`customer` | `supplier`) plus the usual `status` / `paymentMethod` / `currency` / `invoiceId` / `bookingId` / `supplierId` / `paymentDateFrom` / `paymentDateTo` / `search` filters and `sortBy` (`amountCents` | `status` | `paymentDate` | `createdAt`) / `sortDir`. The detail endpoint dispatches by typeid prefix — `pay_*` resolves to a customer payment, `spay_*` resolves to a supplier payment. `bookingId` is applied to both branches: directly to `supplier_payments.booking_id` on the supplier side and via `invoices.booking_id` (joined as `i`) on the customer side, so a booking-scoped query no longer returns unrelated customer rows.
  - `financeService.listAllPayments(db, query)` and `financeService.getPaymentById(db, id)` return a `UnifiedPaymentRow` shape with normalized fields (`personName`, `organizationName`, `supplierName`, `invoiceNumber`, `bookingNumber`) joined in via SQL so the operator UI doesn't need follow-up lookups.
  - New exports: `UnifiedPaymentRow` (service.ts) and `paymentKindSchema` / `paymentListQuerySchema` / `paymentListSortFieldSchema` / `paymentListSortDirSchema` (validation-payments.ts).

  `@voyantjs/finance-react`:

  - New hooks: `useAllPayments(filters)` and `usePayment(id)` plus the underlying `getAllPaymentsQueryOptions` / `getPaymentQueryOptions` query-options factories.
  - New types: `FinancePaymentKind`, `FinanceAllPaymentsListFilters`, `FinanceAllPaymentsListSortField`, `FinanceAllPaymentsListSortDir`.
  - New schemas: `paymentKindSchema`, `unifiedPaymentRecordSchema`, `allPaymentsListResponse`, `paymentSingleResponse`, plus matching `UnifiedPaymentRecord` type.
  - New invoice-payment-mutation invalidation now also invalidates `financeQueryKeys.allPayments()` so the unified feed stays in sync with single-invoice payment flows.

  `@voyantjs/admin`:

  - Operator nav `finance` entry now points at `/finance/invoices` and exposes an `items` sub-nav with `invoices` and `payments` links, matching the new operator page split.

  `@voyantjs/i18n`:

  - Operator nav messages add `invoices` and `payments` (en + ro).
  - Admin finance messages add `invoicesPageTitle`/`invoicesPageDescription`, `paymentsPageTitle`/`paymentsPageDescription`, `recordPayment`, `searchPaymentsPlaceholder`, `kindColumn`/`kindCustomer`/`kindSupplier`/`partyColumn`/`filtersKindLabel`/`filtersKindAll`, plus the `paymentDetail` and `recordPaymentDialog` message groups (en + ro).

- Updated dependencies [60ef432]
  - @voyantjs/finance@0.28.3
  - @voyantjs/react@0.28.3

## 0.28.2

### Patch Changes

- @voyantjs/finance@0.28.2
- @voyantjs/react@0.28.2

## 0.28.1

### Patch Changes

- @voyantjs/finance@0.28.1
- @voyantjs/react@0.28.1

## 0.28.0

### Patch Changes

- @voyantjs/finance@0.28.0
- @voyantjs/react@0.28.0

## 0.27.0

### Patch Changes

- @voyantjs/finance@0.27.0
- @voyantjs/react@0.27.0

## 0.26.9

### Patch Changes

- @voyantjs/finance@0.26.9
- @voyantjs/react@0.26.9

## 0.26.8

### Patch Changes

- @voyantjs/finance@0.26.8
- @voyantjs/react@0.26.8

## 0.26.7

### Patch Changes

- @voyantjs/finance@0.26.7
- @voyantjs/react@0.26.7

## 0.26.6

### Patch Changes

- Updated dependencies [571e340]
  - @voyantjs/finance@0.26.6
  - @voyantjs/react@0.26.6

## 0.26.5

### Patch Changes

- @voyantjs/finance@0.26.5
- @voyantjs/react@0.26.5

## 0.26.4

### Patch Changes

- @voyantjs/finance@0.26.4
- @voyantjs/react@0.26.4

## 0.26.3

### Patch Changes

- @voyantjs/finance@0.26.3
- @voyantjs/react@0.26.3

## 0.26.2

### Patch Changes

- @voyantjs/finance@0.26.2
- @voyantjs/react@0.26.2

## 0.26.1

### Patch Changes

- @voyantjs/finance@0.26.1
- @voyantjs/react@0.26.1

## 0.26.0

### Patch Changes

- @voyantjs/finance@0.26.0
- @voyantjs/react@0.26.0

## 0.25.0

### Patch Changes

- @voyantjs/finance@0.25.0
- @voyantjs/react@0.25.0

## 0.24.3

### Patch Changes

- @voyantjs/finance@0.24.3
- @voyantjs/react@0.24.3

## 0.24.2

### Patch Changes

- @voyantjs/finance@0.24.2
- @voyantjs/react@0.24.2

## 0.24.1

### Patch Changes

- @voyantjs/finance@0.24.1
- @voyantjs/react@0.24.1

## 0.24.0

### Patch Changes

- @voyantjs/finance@0.24.0
- @voyantjs/react@0.24.0

## 0.23.0

### Patch Changes

- @voyantjs/finance@0.23.0
- @voyantjs/react@0.23.0

## 0.22.0

### Patch Changes

- @voyantjs/finance@0.22.0
- @voyantjs/react@0.22.0

## 0.21.1

### Patch Changes

- @voyantjs/finance@0.21.1
- @voyantjs/react@0.21.1

## 0.21.0

### Patch Changes

- Updated dependencies [6427bad]
  - @voyantjs/finance@0.21.0
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
  - @voyantjs/finance@0.20.0
  - @voyantjs/react@0.20.0

## 0.19.0

### Patch Changes

- @voyantjs/finance@0.19.0
- @voyantjs/react@0.19.0

## 0.18.0

### Patch Changes

- @voyantjs/finance@0.18.0
- @voyantjs/react@0.18.0

## 0.17.0

### Patch Changes

- Updated dependencies [66d722d]
  - @voyantjs/finance@0.17.0
  - @voyantjs/react@0.17.0

## 0.16.0

### Patch Changes

- @voyantjs/finance@0.16.0
- @voyantjs/react@0.16.0

## 0.15.0

### Patch Changes

- @voyantjs/finance@0.15.0
- @voyantjs/react@0.15.0

## 0.14.0

### Patch Changes

- @voyantjs/finance@0.14.0
- @voyantjs/react@0.14.0

## 0.13.0

### Patch Changes

- @voyantjs/finance@0.13.0
- @voyantjs/react@0.13.0

## 0.12.0

### Patch Changes

- @voyantjs/finance@0.12.0
- @voyantjs/react@0.12.0

## 0.11.0

### Patch Changes

- @voyantjs/finance@0.11.0
- @voyantjs/react@0.11.0

## 0.10.0

### Patch Changes

- Updated dependencies [29a581a]
  - @voyantjs/finance@0.10.0
  - @voyantjs/react@0.10.0

## 0.9.0

### Patch Changes

- @voyantjs/finance@0.9.0
- @voyantjs/react@0.9.0

## 0.8.0

### Patch Changes

- @voyantjs/finance@0.8.0
- @voyantjs/react@0.8.0

## 0.7.0

### Patch Changes

- Updated dependencies [96612b3]
  - @voyantjs/finance@0.7.0
  - @voyantjs/react@0.7.0

## 0.6.9

### Patch Changes

- @voyantjs/finance@0.6.9
- @voyantjs/react@0.6.9

## 0.6.8

### Patch Changes

- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
  - @voyantjs/finance@0.6.8
  - @voyantjs/react@0.6.8

## 0.6.7

### Patch Changes

- @voyantjs/finance@0.6.7
- @voyantjs/react@0.6.7

## 0.6.6

### Patch Changes

- @voyantjs/finance@0.6.6
- @voyantjs/react@0.6.6

## 0.6.5

### Patch Changes

- @voyantjs/finance@0.6.5
- @voyantjs/react@0.6.5

## 0.6.4

### Patch Changes

- @voyantjs/finance@0.6.4
- @voyantjs/react@0.6.4

## 0.6.3

### Patch Changes

- @voyantjs/finance@0.6.3
- @voyantjs/react@0.6.3

## 0.6.2

### Patch Changes

- @voyantjs/finance@0.6.2
- @voyantjs/react@0.6.2

## 0.6.1

### Patch Changes

- @voyantjs/finance@0.6.1
- @voyantjs/react@0.6.1

## 0.6.0

### Patch Changes

- @voyantjs/finance@0.6.0
- @voyantjs/react@0.6.0

## 0.5.0

### Minor Changes

- ce72e29: Flesh out the operator booking workspace with React hooks for the sections that already existed on the backend.

  - `@voyantjs/bookings-react`: add hooks for booking items (`useBookingItems`, `useBookingItemMutation`), item-traveler assignment (`useBookingItemTravelers`, `useBookingItemTravelerMutation`), documents (`useBookingDocuments`, `useBookingDocumentMutation`), cancellation (`useBookingCancelMutation`), and convert-from-product (`useBookingConvertMutation`).
  - `@voyantjs/finance-react`: add hooks for booking payment schedules (`useBookingPaymentSchedules`, `useBookingPaymentScheduleMutation`) and booking guarantees (`useBookingGuarantees`, `useBookingGuaranteeMutation`).
  - `@voyantjs/legal-react`: add policy resolution (`useResolvePolicy`) and cancellation evaluation (`useEvaluateCancellation`) hooks that power the structured booking cancellation workflow.

### Patch Changes

- @voyantjs/finance@0.5.0
- @voyantjs/react@0.5.0

## 0.4.5

### Patch Changes

- Updated dependencies [e3f6e72]
  - @voyantjs/finance@0.4.5
  - @voyantjs/react@0.4.5

## 0.4.4

### Patch Changes

- @voyantjs/finance@0.4.4
- @voyantjs/react@0.4.4

## 0.4.3

### Patch Changes

- @voyantjs/finance@0.4.3
- @voyantjs/react@0.4.3

## 0.4.2

### Patch Changes

- Updated dependencies [8de4602]
  - @voyantjs/finance@0.4.2
  - @voyantjs/react@0.4.2

## 0.4.1

### Patch Changes

- a49630a: Extend the public finance surface with customer-safe document lookup by reference
  and add typed organization member/invitation exports in `@voyantjs/auth-react`
  for shared team-management UIs.
- Updated dependencies [a49630a]
  - @voyantjs/finance@0.4.1
  - @voyantjs/react@0.4.1

## 0.4.0

### Patch Changes

- e84fe0f: Add a public booking payment-history route and matching React helpers so
  storefronts can read booking-scoped payments with invoice context from
  `/v1/public/finance/bookings/:bookingId/payments`.
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
  - @voyantjs/finance@0.4.0
  - @voyantjs/react@0.4.0

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
  - @voyantjs/finance@0.3.1
  - @voyantjs/react@0.3.1

## 0.3.0

### Patch Changes

- Updated dependencies [e57725d]
  - @voyantjs/finance@0.3.0
  - @voyantjs/react@0.3.0
