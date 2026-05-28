# @voyantjs/catalog

## 0.85.0

### Patch Changes

- @voyantjs/core@0.85.0
- @voyantjs/db@0.85.0
- @voyantjs/hono@0.85.0

## 0.84.4

### Patch Changes

- @voyantjs/core@0.84.4
- @voyantjs/db@0.84.4
- @voyantjs/hono@0.84.4

## 0.84.3

### Patch Changes

- @voyantjs/core@0.84.3
- @voyantjs/db@0.84.3
- @voyantjs/hono@0.84.3

## 0.84.2

### Patch Changes

- @voyantjs/core@0.84.2
- @voyantjs/db@0.84.2
- @voyantjs/hono@0.84.2

## 0.84.1

### Patch Changes

- Updated dependencies [b9ef614]
  - @voyantjs/core@0.84.1
  - @voyantjs/db@0.84.1
  - @voyantjs/hono@0.84.1

## 0.84.0

### Patch Changes

- Updated dependencies [4ea42b3]
  - @voyantjs/core@0.84.0
  - @voyantjs/db@0.84.0
  - @voyantjs/hono@0.84.0

## 0.83.1

### Patch Changes

- @voyantjs/core@0.83.1
- @voyantjs/db@0.83.1
- @voyantjs/hono@0.83.1

## 0.83.0

### Patch Changes

- @voyantjs/core@0.83.0
- @voyantjs/db@0.83.0
- @voyantjs/hono@0.83.0

## 0.82.1

### Patch Changes

- @voyantjs/core@0.82.1
- @voyantjs/db@0.82.1
- @voyantjs/hono@0.82.1

## 0.82.0

### Patch Changes

- @voyantjs/core@0.82.0
- @voyantjs/db@0.82.0
- @voyantjs/hono@0.82.0

## 0.81.21

### Patch Changes

- @voyantjs/core@0.81.21
- @voyantjs/db@0.81.21
- @voyantjs/hono@0.81.21

## 0.81.20

### Patch Changes

- @voyantjs/core@0.81.20
- @voyantjs/db@0.81.20
- @voyantjs/hono@0.81.20

## 0.81.19

### Patch Changes

- @voyantjs/core@0.81.19
- @voyantjs/db@0.81.19
- @voyantjs/hono@0.81.19

## 0.81.18

### Patch Changes

- @voyantjs/core@0.81.18
- @voyantjs/db@0.81.18
- @voyantjs/hono@0.81.18

## 0.81.17

### Patch Changes

- @voyantjs/core@0.81.17
- @voyantjs/db@0.81.17
- @voyantjs/hono@0.81.17

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
  - @voyantjs/core@0.81.16
  - @voyantjs/db@0.81.16
  - @voyantjs/hono@0.81.16

## 0.81.15

### Patch Changes

- @voyantjs/core@0.81.15
- @voyantjs/db@0.81.15
- @voyantjs/hono@0.81.15

## 0.81.14

### Patch Changes

- @voyantjs/core@0.81.14
- @voyantjs/db@0.81.14
- @voyantjs/hono@0.81.14

## 0.81.13

### Patch Changes

- @voyantjs/core@0.81.13
- @voyantjs/db@0.81.13
- @voyantjs/hono@0.81.13

## 0.81.12

### Patch Changes

- @voyantjs/core@0.81.12
- @voyantjs/db@0.81.12
- @voyantjs/hono@0.81.12

## 0.81.11

### Patch Changes

- @voyantjs/core@0.81.11
- @voyantjs/db@0.81.11
- @voyantjs/hono@0.81.11

## 0.81.10

### Patch Changes

- @voyantjs/core@0.81.10
- @voyantjs/db@0.81.10
- @voyantjs/hono@0.81.10

## 0.81.9

### Patch Changes

- @voyantjs/core@0.81.9
- @voyantjs/db@0.81.9
- @voyantjs/hono@0.81.9

## 0.81.8

### Patch Changes

- @voyantjs/core@0.81.8
- @voyantjs/db@0.81.8
- @voyantjs/hono@0.81.8

## 0.81.7

### Patch Changes

- @voyantjs/core@0.81.7
- @voyantjs/db@0.81.7
- @voyantjs/hono@0.81.7

## 0.81.6

### Patch Changes

- @voyantjs/core@0.81.6
- @voyantjs/db@0.81.6
- @voyantjs/hono@0.81.6

## 0.81.5

### Patch Changes

- @voyantjs/core@0.81.5
- @voyantjs/db@0.81.5
- @voyantjs/hono@0.81.5

## 0.81.4

### Patch Changes

- @voyantjs/core@0.81.4
- @voyantjs/db@0.81.4
- @voyantjs/hono@0.81.4

## 0.81.3

### Patch Changes

- @voyantjs/core@0.81.3
- @voyantjs/db@0.81.3
- @voyantjs/hono@0.81.3

## 0.81.2

### Patch Changes

- @voyantjs/core@0.81.2
- @voyantjs/db@0.81.2
- @voyantjs/hono@0.81.2

## 0.81.1

### Patch Changes

- @voyantjs/core@0.81.1
- @voyantjs/db@0.81.1
- @voyantjs/hono@0.81.1

## 0.81.0

### Patch Changes

- @voyantjs/core@0.81.0
- @voyantjs/db@0.81.0
- @voyantjs/hono@0.81.0

## 0.80.18

### Patch Changes

- @voyantjs/core@0.80.18
- @voyantjs/db@0.80.18
- @voyantjs/hono@0.80.18

## 0.80.17

### Patch Changes

- @voyantjs/core@0.80.17
- @voyantjs/db@0.80.17
- @voyantjs/hono@0.80.17

## 0.80.16

### Patch Changes

- @voyantjs/core@0.80.16
- @voyantjs/db@0.80.16
- @voyantjs/hono@0.80.16

## 0.80.15

### Patch Changes

- @voyantjs/core@0.80.15
- @voyantjs/db@0.80.15
- @voyantjs/hono@0.80.15

## 0.80.14

### Patch Changes

- @voyantjs/core@0.80.14
- @voyantjs/db@0.80.14
- @voyantjs/hono@0.80.14

## 0.80.13

### Patch Changes

- @voyantjs/core@0.80.13
- @voyantjs/db@0.80.13
- @voyantjs/hono@0.80.13

## 0.80.12

### Patch Changes

- @voyantjs/core@0.80.12
- @voyantjs/db@0.80.12
- @voyantjs/hono@0.80.12

## 0.80.11

### Patch Changes

- @voyantjs/core@0.80.11
- @voyantjs/db@0.80.11
- @voyantjs/hono@0.80.11

## 0.80.10

### Patch Changes

- @voyantjs/core@0.80.10
- @voyantjs/db@0.80.10
- @voyantjs/hono@0.80.10

## 0.80.9

### Patch Changes

- @voyantjs/core@0.80.9
- @voyantjs/db@0.80.9
- @voyantjs/hono@0.80.9

## 0.80.8

### Patch Changes

- @voyantjs/core@0.80.8
- @voyantjs/db@0.80.8
- @voyantjs/hono@0.80.8

## 0.80.7

### Patch Changes

- @voyantjs/core@0.80.7
- @voyantjs/db@0.80.7
- @voyantjs/hono@0.80.7

## 0.80.6

### Patch Changes

- @voyantjs/core@0.80.6
- @voyantjs/db@0.80.6
- @voyantjs/hono@0.80.6

## 0.80.5

### Patch Changes

- @voyantjs/core@0.80.5
- @voyantjs/db@0.80.5
- @voyantjs/hono@0.80.5

## 0.80.4

### Patch Changes

- @voyantjs/core@0.80.4
- @voyantjs/db@0.80.4
- @voyantjs/hono@0.80.4

## 0.80.3

### Patch Changes

- Updated dependencies [6d816bb]
  - @voyantjs/core@0.80.3
  - @voyantjs/db@0.80.3
  - @voyantjs/hono@0.80.3

## 0.80.2

### Patch Changes

- @voyantjs/core@0.80.2
- @voyantjs/db@0.80.2
- @voyantjs/hono@0.80.2

## 0.80.1

### Patch Changes

- @voyantjs/core@0.80.1
- @voyantjs/db@0.80.1
- @voyantjs/hono@0.80.1

## 0.80.0

### Patch Changes

- @voyantjs/core@0.80.0
- @voyantjs/db@0.80.0
- @voyantjs/hono@0.80.0

## 0.79.0

### Patch Changes

- @voyantjs/core@0.79.0
- @voyantjs/db@0.79.0
- @voyantjs/hono@0.79.0

## 0.78.0

### Patch Changes

- @voyantjs/core@0.78.0
- @voyantjs/db@0.78.0
- @voyantjs/hono@0.78.0

## 0.77.13

### Patch Changes

- @voyantjs/core@0.77.13
- @voyantjs/db@0.77.13
- @voyantjs/hono@0.77.13

## 0.77.12

### Patch Changes

- @voyantjs/core@0.77.12
- @voyantjs/db@0.77.12
- @voyantjs/hono@0.77.12

## 0.77.11

### Patch Changes

- @voyantjs/core@0.77.11
- @voyantjs/db@0.77.11
- @voyantjs/hono@0.77.11

## 0.77.10

### Patch Changes

- @voyantjs/core@0.77.10
- @voyantjs/db@0.77.10
- @voyantjs/hono@0.77.10

## 0.77.9

### Patch Changes

- @voyantjs/core@0.77.9
- @voyantjs/db@0.77.9
- @voyantjs/hono@0.77.9

## 0.77.8

### Patch Changes

- @voyantjs/core@0.77.8
- @voyantjs/db@0.77.8
- @voyantjs/hono@0.77.8

## 0.77.7

### Patch Changes

- @voyantjs/core@0.77.7
- @voyantjs/db@0.77.7
- @voyantjs/hono@0.77.7

## 0.77.6

### Patch Changes

- @voyantjs/core@0.77.6
- @voyantjs/db@0.77.6
- @voyantjs/hono@0.77.6

## 0.77.5

### Patch Changes

- @voyantjs/core@0.77.5
- @voyantjs/db@0.77.5
- @voyantjs/hono@0.77.5

## 0.77.4

### Patch Changes

- @voyantjs/core@0.77.4
- @voyantjs/db@0.77.4
- @voyantjs/hono@0.77.4

## 0.77.3

### Patch Changes

- @voyantjs/core@0.77.3
- @voyantjs/db@0.77.3
- @voyantjs/hono@0.77.3

## 0.77.2

### Patch Changes

- @voyantjs/core@0.77.2
- @voyantjs/db@0.77.2
- @voyantjs/hono@0.77.2

## 0.77.1

### Patch Changes

- @voyantjs/core@0.77.1
- @voyantjs/db@0.77.1
- @voyantjs/hono@0.77.1

## 0.77.0

### Patch Changes

- Updated dependencies [1da934d]
  - @voyantjs/core@0.77.0
  - @voyantjs/db@0.77.0
  - @voyantjs/hono@0.77.0

## 0.76.0

### Patch Changes

- @voyantjs/core@0.76.0
- @voyantjs/db@0.76.0
- @voyantjs/hono@0.76.0

## 0.75.7

### Patch Changes

- @voyantjs/core@0.75.7
- @voyantjs/db@0.75.7
- @voyantjs/hono@0.75.7

## 0.75.6

### Patch Changes

- @voyantjs/core@0.75.6
- @voyantjs/db@0.75.6
- @voyantjs/hono@0.75.6

## 0.75.5

### Patch Changes

- @voyantjs/core@0.75.5
- @voyantjs/db@0.75.5
- @voyantjs/hono@0.75.5

## 0.75.4

### Patch Changes

- @voyantjs/core@0.75.4
- @voyantjs/db@0.75.4
- @voyantjs/hono@0.75.4

## 0.75.3

### Patch Changes

- @voyantjs/core@0.75.3
- @voyantjs/db@0.75.3
- @voyantjs/hono@0.75.3

## 0.75.2

### Patch Changes

- @voyantjs/core@0.75.2
- @voyantjs/db@0.75.2
- @voyantjs/hono@0.75.2

## 0.75.1

### Patch Changes

- @voyantjs/core@0.75.1
- @voyantjs/db@0.75.1
- @voyantjs/hono@0.75.1

## 0.75.0

### Patch Changes

- @voyantjs/core@0.75.0
- @voyantjs/db@0.75.0
- @voyantjs/hono@0.75.0

## 0.74.2

### Patch Changes

- @voyantjs/core@0.74.2
- @voyantjs/db@0.74.2
- @voyantjs/hono@0.74.2

## 0.74.1

### Patch Changes

- @voyantjs/core@0.74.1
- @voyantjs/db@0.74.1
- @voyantjs/hono@0.74.1

## 0.74.0

### Patch Changes

- @voyantjs/core@0.74.0
- @voyantjs/db@0.74.0
- @voyantjs/hono@0.74.0

## 0.73.1

### Patch Changes

- @voyantjs/core@0.73.1
- @voyantjs/db@0.73.1
- @voyantjs/hono@0.73.1

## 0.73.0

### Patch Changes

- @voyantjs/core@0.73.0
- @voyantjs/db@0.73.0
- @voyantjs/hono@0.73.0

## 0.72.0

### Patch Changes

- @voyantjs/core@0.72.0
- @voyantjs/db@0.72.0
- @voyantjs/hono@0.72.0

## 0.71.0

### Patch Changes

- @voyantjs/core@0.71.0
- @voyantjs/db@0.71.0
- @voyantjs/hono@0.71.0

## 0.70.0

### Patch Changes

- @voyantjs/core@0.70.0
- @voyantjs/db@0.70.0
- @voyantjs/hono@0.70.0

## 0.69.1

### Patch Changes

- @voyantjs/core@0.69.1
- @voyantjs/db@0.69.1
- @voyantjs/hono@0.69.1

## 0.69.0

### Patch Changes

- @voyantjs/core@0.69.0
- @voyantjs/db@0.69.0
- @voyantjs/hono@0.69.0

## 0.68.0

### Patch Changes

- @voyantjs/core@0.68.0
- @voyantjs/db@0.68.0
- @voyantjs/hono@0.68.0

## 0.67.0

### Patch Changes

- @voyantjs/core@0.67.0
- @voyantjs/db@0.67.0
- @voyantjs/hono@0.67.0

## 0.66.6

### Patch Changes

- @voyantjs/core@0.66.6
- @voyantjs/db@0.66.6
- @voyantjs/hono@0.66.6

## 0.66.5

### Patch Changes

- @voyantjs/core@0.66.5
- @voyantjs/db@0.66.5
- @voyantjs/hono@0.66.5

## 0.66.4

### Patch Changes

- @voyantjs/core@0.66.4
- @voyantjs/db@0.66.4
- @voyantjs/hono@0.66.4

## 0.66.3

### Patch Changes

- @voyantjs/core@0.66.3
- @voyantjs/db@0.66.3
- @voyantjs/hono@0.66.3

## 0.66.2

### Patch Changes

- @voyantjs/core@0.66.2
- @voyantjs/db@0.66.2
- @voyantjs/hono@0.66.2

## 0.66.1

### Patch Changes

- @voyantjs/core@0.66.1
- @voyantjs/db@0.66.1
- @voyantjs/hono@0.66.1

## 0.66.0

### Patch Changes

- @voyantjs/core@0.66.0
- @voyantjs/db@0.66.0
- @voyantjs/hono@0.66.0

## 0.65.0

### Patch Changes

- @voyantjs/core@0.65.0
- @voyantjs/db@0.65.0
- @voyantjs/hono@0.65.0

## 0.64.1

### Patch Changes

- @voyantjs/core@0.64.1
- @voyantjs/db@0.64.1
- @voyantjs/hono@0.64.1

## 0.64.0

### Patch Changes

- Updated dependencies [6d0c8f3]
  - @voyantjs/core@0.64.0
  - @voyantjs/db@0.64.0
  - @voyantjs/hono@0.64.0

## 0.63.1

### Patch Changes

- @voyantjs/core@0.63.1
- @voyantjs/db@0.63.1
- @voyantjs/hono@0.63.1

## 0.63.0

### Patch Changes

- @voyantjs/core@0.63.0
- @voyantjs/db@0.63.0
- @voyantjs/hono@0.63.0

## 0.62.3

### Patch Changes

- @voyantjs/core@0.62.3
- @voyantjs/db@0.62.3
- @voyantjs/hono@0.62.3

## 0.62.2

### Patch Changes

- @voyantjs/core@0.62.2
- @voyantjs/db@0.62.2
- @voyantjs/hono@0.62.2

## 0.62.1

### Patch Changes

- @voyantjs/core@0.62.1
- @voyantjs/db@0.62.1
- @voyantjs/hono@0.62.1

## 0.62.0

### Patch Changes

- Updated dependencies [77aad68]
  - @voyantjs/core@0.62.0
  - @voyantjs/db@0.62.0
  - @voyantjs/hono@0.62.0

## 0.61.0

### Patch Changes

- @voyantjs/core@0.61.0
- @voyantjs/db@0.61.0
- @voyantjs/hono@0.61.0

## 0.60.0

### Patch Changes

- @voyantjs/core@0.60.0
- @voyantjs/db@0.60.0
- @voyantjs/hono@0.60.0

## 0.59.0

### Minor Changes

- 48927be: Release the changes accumulated on main since 0.58.0 that landed without
  their own changesets.

  - **products / products-react / products-ui** — add `inclusionsHtml` and
    `exclusionsHtml` rich-text fields on `ProductRecord` plus the supporting
    product-form + product-detail UI (#994). Consumer test fixtures may need
    `inclusionsHtml: null, exclusionsHtml: null` added.
  - **catalog** — widen `CancelResult.status` to include `"pending"` for
    adapters that submit async cancellations (email / partner portal / batch)
    with a `pending_channel` (#991). Downstream consumers using the narrow
    `"cancelled" | "refused" | "failed"` union need to either widen their
    surface or map `"pending"` at the boundary.
  - **ui** — drop heavy passthrough re-exports from `@voyantjs/ui/components`
    barrel: `RichTextEditor`, `chart`, `dashboard-widgets`, `phone-input`,
    and all `NotificationTemplate*` / `notification-template-dialog` /
    `notification-{deliveries,reminder-rules,reminder-runs}-page` entries.
    Import these via subpath from `@voyantjs/ui/components/<file>` instead
    (e.g. `@voyantjs/ui/components/rich-text-editor`). Was leaking ~600 KB
    of tiptap/prosemirror, ~390 KB of recharts, and ~200 KB of
    libphonenumber-js into every barrel consumer.
  - **admin** — drop `DashboardPage` from the `@voyantjs/admin` barrel for
    the same reason (recharts leakage). Import from
    `@voyantjs/admin/dashboard` instead.

### Patch Changes

- @voyantjs/core@0.59.0
- @voyantjs/db@0.59.0
- @voyantjs/hono@0.59.0

## 0.58.0

### Minor Changes

- 5b21488: Add zod runtime schemas for the public catalog source-adapter contract, including request/result payloads, capabilities, provenance, adapter context, and channel-push shapes. Extend reserve/cancel adapter writes with optional request scope and idempotency keys, and model async cancellation with pending status metadata.

### Patch Changes

- @voyantjs/core@0.58.0
- @voyantjs/db@0.58.0
- @voyantjs/hono@0.58.0

## 0.57.0

### Patch Changes

- @voyantjs/core@0.57.0
- @voyantjs/db@0.57.0
- @voyantjs/hono@0.57.0

## 0.56.0

### Patch Changes

- @voyantjs/core@0.56.0
- @voyantjs/db@0.56.0
- @voyantjs/hono@0.56.0

## 0.55.1

### Patch Changes

- 819c847: Ship the composed trip admin workflow and booking extras integration.

  Admin surfaces now include trip list/detail/composer routes, catalog-backed
  trip assembly, aggregate checkout handoff, payment-link trip summaries, and
  trip-aware navigation. Booking journeys and regular booking creation can route
  operators into the composer when the customer is building a multi-component
  itinerary.

  Catalog booking draft shapes now expose richer add-on offers, and owned product
  booking handlers can price and commit selected extras. Product detail pages can
  manage extras, booking create can select extras, and finance booking creation
  persists selected extras as booking items so invoices and payment links include
  them.

  Checkout payment pages now render clearer trip summaries, flight booking UI
  supports the refined baggage/one-way behavior used by the composer, shared UI
  exports the date-time field, and i18n includes the new trip admin copy.

- Updated dependencies [819c847]
  - @voyantjs/core@0.55.1
  - @voyantjs/db@0.55.1
  - @voyantjs/hono@0.55.1

## 0.55.0

### Patch Changes

- @voyantjs/core@0.55.0
- @voyantjs/db@0.55.0
- @voyantjs/hono@0.55.0

## 0.54.0

### Patch Changes

- @voyantjs/core@0.54.0
- @voyantjs/db@0.54.0
- @voyantjs/hono@0.54.0

## 0.53.2

### Patch Changes

- @voyantjs/core@0.53.2
- @voyantjs/db@0.53.2
- @voyantjs/hono@0.53.2

## 0.53.1

### Patch Changes

- @voyantjs/core@0.53.1
- @voyantjs/db@0.53.1
- @voyantjs/hono@0.53.1

## 0.53.0

### Patch Changes

- @voyantjs/core@0.53.0
- @voyantjs/db@0.53.0
- @voyantjs/hono@0.53.0

## 0.52.4

### Patch Changes

- @voyantjs/core@0.52.4
- @voyantjs/db@0.52.4
- @voyantjs/hono@0.52.4

## 0.52.3

### Patch Changes

- Updated dependencies [9679a57]
  - @voyantjs/core@0.52.3
  - @voyantjs/db@0.52.3
  - @voyantjs/hono@0.52.3

## 0.52.2

### Patch Changes

- @voyantjs/core@0.52.2
- @voyantjs/db@0.52.2
- @voyantjs/hono@0.52.2

## 0.52.1

### Patch Changes

- @voyantjs/core@0.52.1
- @voyantjs/db@0.52.1
- @voyantjs/hono@0.52.1

## 0.52.0

### Patch Changes

- @voyantjs/core@0.52.0
- @voyantjs/db@0.52.0
- @voyantjs/hono@0.52.0

## 0.51.1

### Patch Changes

- @voyantjs/core@0.51.1
- @voyantjs/db@0.51.1
- @voyantjs/hono@0.51.1

## 0.51.0

### Patch Changes

- @voyantjs/core@0.51.0
- @voyantjs/db@0.51.0
- @voyantjs/hono@0.51.0

## 0.50.8

### Patch Changes

- @voyantjs/core@0.50.8
- @voyantjs/db@0.50.8
- @voyantjs/hono@0.50.8

## 0.50.7

### Patch Changes

- @voyantjs/core@0.50.7
- @voyantjs/db@0.50.7
- @voyantjs/hono@0.50.7

## 0.50.6

### Patch Changes

- @voyantjs/core@0.50.6
- @voyantjs/db@0.50.6
- @voyantjs/hono@0.50.6

## 0.50.5

### Patch Changes

- @voyantjs/core@0.50.5
- @voyantjs/db@0.50.5
- @voyantjs/hono@0.50.5

## 0.50.4

### Patch Changes

- @voyantjs/core@0.50.4
- @voyantjs/db@0.50.4
- @voyantjs/hono@0.50.4

## 0.50.3

### Patch Changes

- @voyantjs/core@0.50.3
- @voyantjs/db@0.50.3
- @voyantjs/hono@0.50.3

## 0.50.2

### Patch Changes

- @voyantjs/core@0.50.2
- @voyantjs/db@0.50.2
- @voyantjs/hono@0.50.2

## 0.50.1

### Patch Changes

- @voyantjs/core@0.50.1
- @voyantjs/db@0.50.1
- @voyantjs/hono@0.50.1

## 0.50.0

### Patch Changes

- @voyantjs/core@0.50.0
- @voyantjs/db@0.50.0
- @voyantjs/hono@0.50.0

## 0.49.0

### Patch Changes

- @voyantjs/core@0.49.0
- @voyantjs/db@0.49.0
- @voyantjs/hono@0.49.0

## 0.48.0

### Patch Changes

- @voyantjs/core@0.48.0
- @voyantjs/db@0.48.0
- @voyantjs/hono@0.48.0

## 0.47.0

### Patch Changes

- @voyantjs/core@0.47.0
- @voyantjs/db@0.47.0
- @voyantjs/hono@0.47.0

## 0.46.0

### Patch Changes

- @voyantjs/core@0.46.0
- @voyantjs/db@0.46.0
- @voyantjs/hono@0.46.0

## 0.45.0

### Patch Changes

- @voyantjs/core@0.45.0
- @voyantjs/db@0.45.0
- @voyantjs/hono@0.45.0

## 0.44.0

### Patch Changes

- @voyantjs/core@0.44.0
- @voyantjs/db@0.44.0
- @voyantjs/hono@0.44.0

## 0.43.0

### Patch Changes

- Updated dependencies [d07215e]
  - @voyantjs/core@0.43.0
  - @voyantjs/db@0.43.0
  - @voyantjs/hono@0.43.0

## 0.42.0

### Patch Changes

- @voyantjs/core@0.42.0
- @voyantjs/db@0.42.0
- @voyantjs/hono@0.42.0

## 0.41.3

### Patch Changes

- @voyantjs/core@0.41.3
- @voyantjs/db@0.41.3
- @voyantjs/hono@0.41.3

## 0.41.2

### Patch Changes

- @voyantjs/core@0.41.2
- @voyantjs/db@0.41.2
- @voyantjs/hono@0.41.2

## 0.41.1

### Patch Changes

- @voyantjs/core@0.41.1
- @voyantjs/db@0.41.1
- @voyantjs/hono@0.41.1

## 0.41.0

### Patch Changes

- @voyantjs/core@0.41.0
- @voyantjs/db@0.41.0
- @voyantjs/hono@0.41.0

## 0.40.1

### Patch Changes

- @voyantjs/core@0.40.1
- @voyantjs/db@0.40.1
- @voyantjs/hono@0.40.1

## 0.40.0

### Patch Changes

- @voyantjs/core@0.40.0
- @voyantjs/db@0.40.0
- @voyantjs/hono@0.40.0

## 0.39.0

### Patch Changes

- @voyantjs/core@0.39.0
- @voyantjs/db@0.39.0
- @voyantjs/hono@0.39.0

## 0.38.2

### Patch Changes

- @voyantjs/core@0.38.2
- @voyantjs/db@0.38.2
- @voyantjs/hono@0.38.2

## 0.38.1

### Patch Changes

- @voyantjs/core@0.38.1
- @voyantjs/db@0.38.1
- @voyantjs/hono@0.38.1

## 0.38.0

### Patch Changes

- @voyantjs/core@0.38.0
- @voyantjs/db@0.38.0
- @voyantjs/hono@0.38.0

## 0.37.1

### Patch Changes

- @voyantjs/core@0.37.1
- @voyantjs/db@0.37.1
- @voyantjs/hono@0.37.1

## 0.37.0

### Patch Changes

- @voyantjs/core@0.37.0
- @voyantjs/db@0.37.0
- @voyantjs/hono@0.37.0

## 0.36.0

### Patch Changes

- @voyantjs/core@0.36.0
- @voyantjs/db@0.36.0
- @voyantjs/hono@0.36.0

## 0.35.0

### Patch Changes

- @voyantjs/core@0.35.0
- @voyantjs/db@0.35.0
- @voyantjs/hono@0.35.0

## 0.34.0

### Patch Changes

- @voyantjs/core@0.34.0
- @voyantjs/db@0.34.0
- @voyantjs/hono@0.34.0

## 0.33.1

### Patch Changes

- @voyantjs/core@0.33.1
- @voyantjs/db@0.33.1
- @voyantjs/hono@0.33.1

## 0.33.0

### Patch Changes

- @voyantjs/core@0.33.0
- @voyantjs/db@0.33.0
- @voyantjs/hono@0.33.0

## 0.32.3

### Patch Changes

- @voyantjs/core@0.32.3
- @voyantjs/db@0.32.3
- @voyantjs/hono@0.32.3

## 0.32.2

### Patch Changes

- @voyantjs/core@0.32.2
- @voyantjs/db@0.32.2
- @voyantjs/hono@0.32.2

## 0.32.1

### Patch Changes

- @voyantjs/core@0.32.1
- @voyantjs/db@0.32.1
- @voyantjs/hono@0.32.1

## 0.32.0

### Patch Changes

- Updated dependencies [6ea6ded]
  - @voyantjs/core@0.32.0
  - @voyantjs/db@0.32.0
  - @voyantjs/hono@0.32.0

## 0.31.4

### Patch Changes

- @voyantjs/core@0.31.4
- @voyantjs/db@0.31.4
- @voyantjs/hono@0.31.4

## 0.31.3

### Patch Changes

- Updated dependencies [5f974dd]
  - @voyantjs/core@0.31.3
  - @voyantjs/db@0.31.3
  - @voyantjs/hono@0.31.3

## 0.31.2

### Patch Changes

- Updated dependencies [54ddc93]
  - @voyantjs/core@0.31.2
  - @voyantjs/db@0.31.2
  - @voyantjs/hono@0.31.2

## 0.31.1

### Patch Changes

- @voyantjs/core@0.31.1
- @voyantjs/db@0.31.1
- @voyantjs/hono@0.31.1

## 0.31.0

### Patch Changes

- @voyantjs/core@0.31.0
- @voyantjs/db@0.31.0
- @voyantjs/hono@0.31.0

## 0.30.7

### Patch Changes

- @voyantjs/core@0.30.7
- @voyantjs/db@0.30.7
- @voyantjs/hono@0.30.7

## 0.30.6

### Patch Changes

- Updated dependencies [5a4c592]
  - @voyantjs/core@0.30.6
  - @voyantjs/db@0.30.6
  - @voyantjs/hono@0.30.6

## 0.30.5

### Patch Changes

- Updated dependencies [3f323e9]
  - @voyantjs/core@0.30.5
  - @voyantjs/db@0.30.5
  - @voyantjs/hono@0.30.5

## 0.30.4

### Patch Changes

- @voyantjs/core@0.30.4
- @voyantjs/db@0.30.4
- @voyantjs/hono@0.30.4

## 0.30.3

### Patch Changes

- Updated dependencies [05a1b19]
  - @voyantjs/core@0.30.3
  - @voyantjs/db@0.30.3
  - @voyantjs/hono@0.30.3

## 0.30.2

### Patch Changes

- @voyantjs/core@0.30.2
- @voyantjs/db@0.30.2
- @voyantjs/hono@0.30.2

## 0.30.1

### Patch Changes

- @voyantjs/core@0.30.1
- @voyantjs/db@0.30.1
- @voyantjs/hono@0.30.1

## 0.30.0

### Patch Changes

- @voyantjs/core@0.30.0
- @voyantjs/db@0.30.0
- @voyantjs/hono@0.30.0

## 0.29.0

### Minor Changes

- 583326e: PR4 of #497: booking-engine + storefront integration.

  Customers can now enter a promotion code at checkout, see the discount applied to the pre-tax base on the quote, complete the booking, and end up with a redemption row recorded by the post-commit subscriber. Storefront's `/v1/public/products/:productId/offers` and `/v1/public/offers/:slug` endpoints (previously empty) now return real data.

  **`@voyantjs/catalog`** —

  - **Field rename**: `BookingDraft.voucher: { code }` → `BookingDraft.promotionCode: string`. Avoids permanent collision with the finance `vouchers` domain. Single live consumer (`@voyantjs/catalog-react`'s `useBookingQuote` hook) updated.
  - **New `./booking-engine` exports**: `AppliedOffer`, `CodeStatus`, `PromotionEvaluationInput`, `PromotionEvaluationOutput` — the contract types templates implement to wire promotions. Catalog stays decoupled from `@voyantjs/promotions`.
  - **`QuoteEntityDeps.evaluatePromotions`** — optional async hook called inside `quoteEntity` after the adapter returns pricing (only for `entity_module === "products"` in v1). Discounts apply to `pricing.base_amount` pre-tax so the operator template's `applyOperatorTaxToQuoteResult` step downstream recomputes taxes against the new base. Bad-code outcomes surface as `code_*` `invalidReason` on the quote (`code_not_found`, `code_expired`, `code_not_yet_valid`, `code_not_applicable`).
  - **`CatalogBookingRoutesOptions.resolveEvaluatePromotions`** — per-request callback templates wire so the hook closes over the request's `db`.
  - **Schema additions**:
    - `catalog_quotes.pricing_applied_offers` (JSONB, typed `AppliedOffer[]`).
    - `booking_catalog_snapshot.pricing_applied_offers` (JSONB) — frozen for audit; survives source-offer mutation.
    - Index `idx_catalog_quotes_consumed_booking` on `consumed_booking_id` for the post-commit subscriber's lookup.
  - **`PricingBasis.appliedOffers?: AppliedOffer[]`** added in-memory; `readPricingBasis`, `readPricingFromQuote`, `snapshotToPricing`, `captureSnapshot`, and `captureSnapshotGraph` all updated to round-trip the field.

  **`@voyantjs/promotions`** —

  - **`./service-catalog-evaluator`** — `createCatalogPromotionEvaluator(db)` adapter factory. Bridges catalog's `PromotionEvaluationInput` / `PromotionEvaluationOutput` to the package's internal evaluator (PR2). Operator template wires it via `resolveEvaluatePromotions`.
  - **`./service-booking-confirmed`** — `recordPromotionRedemptionsForBooking(db, bookingId)`. Reads `pricing_applied_offers` from `catalog_quotes` joined to the booking via `consumed_booking_id` (NOT from the snapshot, to avoid an ordering race with `captureSnapshotGraph`). Aggregates per-offer (sums `discount_applied_cents` across multiple line-item snapshots; first non-null `appliedCode` wins). Idempotent upsert into `promotional_offer_redemptions` via `(offer_id, booking_id)` unique index — replay-safe.
  - **`./service-storefront`** — `createPromotionsStorefrontResolvers()` returning `StorefrontOfferResolvers`. Maps offer rows to the `StorefrontPromotionalOffer` DTO (single `discountValue` string for both `percentage` and `fixed_amount` flavors; `applicableDepartureIds: []` per v1 limitation).
  - New deps: `@voyantjs/catalog`, `@voyantjs/storefront` (workspace).

  **Operator template** —

  - `catalog-booking.ts` wires `resolveEvaluatePromotions: ({ db }) => createCatalogPromotionEvaluator(db)` so the hook fires for every quote.
  - `app.ts` wires `createPromotionsStorefrontResolvers()` into `createStorefrontHonoModule({ offers })`.
  - `catalog-bridge.ts` registers a second `booking.confirmed` subscriber alongside the existing snapshot capture; the new subscriber calls `recordPromotionRedemptionsForBooking`. Failure logs but doesn't rethrow (sibling subscribers shouldn't be blocked); ops can backfill from snapshot's `pricing_applied_offers`.
  - Drizzle migration `0008_white_bucky.sql` generated for the column + index additions.

  **Validation**:

  - `pnpm -F (@voyantjs/catalog, @voyantjs/promotions, @voyantjs/storefront, operator) typecheck` — clean (operator runs with `NODE_OPTIONS=--max-old-space-size=8192` due to large workspace heap requirements).
  - `pnpm -F @voyantjs/promotions test` — 84 unit tests pass; 32 integration tests skip without `TEST_DATABASE_URL` (added 6 new for the redemption recorder, 8 new for storefront resolver).
  - Biome lint clean across all touched files.

  **Honest about what the post-commit pattern guarantees**: `bookEntity` doesn't have a single enclosing transaction, so the redemption subscriber accepts a small audit gap on permanent failure (mitigated by `pricing_applied_offers` on the snapshot enabling backfill, and idempotent upsert handling subscriber retries). This was the explicit decision in §15.2 of the architecture doc.

### Patch Changes

- Updated dependencies [583326e]
- Updated dependencies [583326e]
- Updated dependencies [4a6523e]
- Updated dependencies [db51715]
  - @voyantjs/core@0.29.0
  - @voyantjs/db@0.29.0
  - @voyantjs/hono@0.29.0

## 0.28.3

### Patch Changes

- @voyantjs/core@0.28.3
- @voyantjs/db@0.28.3
- @voyantjs/hono@0.28.3

## 0.28.2

### Patch Changes

- @voyantjs/core@0.28.2
- @voyantjs/db@0.28.2
- @voyantjs/hono@0.28.2

## 0.28.1

### Patch Changes

- @voyantjs/core@0.28.1
- @voyantjs/db@0.28.1
- @voyantjs/hono@0.28.1

## 0.28.0

### Patch Changes

- @voyantjs/core@0.28.0
- @voyantjs/db@0.28.0
- @voyantjs/hono@0.28.0

## 0.27.0

### Patch Changes

- @voyantjs/core@0.27.0
- @voyantjs/db@0.27.0
- @voyantjs/hono@0.27.0

## 0.26.9

### Patch Changes

- @voyantjs/core@0.26.9
- @voyantjs/db@0.26.9
- @voyantjs/hono@0.26.9

## 0.26.8

### Patch Changes

- @voyantjs/core@0.26.8
- @voyantjs/db@0.26.8
- @voyantjs/hono@0.26.8

## 0.26.7

### Patch Changes

- @voyantjs/core@0.26.7
- @voyantjs/db@0.26.7
- @voyantjs/hono@0.26.7

## 0.26.6

### Patch Changes

- @voyantjs/core@0.26.6
- @voyantjs/db@0.26.6
- @voyantjs/hono@0.26.6

## 0.26.5

### Patch Changes

- Updated dependencies [7a92aba]
  - @voyantjs/core@0.26.5
  - @voyantjs/db@0.26.5
  - @voyantjs/hono@0.26.5

## 0.26.4

### Patch Changes

- Updated dependencies [6493f62]
  - @voyantjs/core@0.26.4
  - @voyantjs/db@0.26.4
  - @voyantjs/hono@0.26.4

## 0.26.3

### Patch Changes

- Updated dependencies [372cad5]
  - @voyantjs/core@0.26.3
  - @voyantjs/db@0.26.3
  - @voyantjs/hono@0.26.3

## 0.26.2

### Patch Changes

- Updated dependencies [ffdb485]
  - @voyantjs/core@0.26.2
  - @voyantjs/db@0.26.2
  - @voyantjs/hono@0.26.2

## 0.26.1

### Patch Changes

- Updated dependencies [c0507a6]
  - @voyantjs/core@0.26.1
  - @voyantjs/db@0.26.1
  - @voyantjs/hono@0.26.1

## 0.26.0

### Patch Changes

- @voyantjs/core@0.26.0
- @voyantjs/db@0.26.0
- @voyantjs/hono@0.26.0

## 0.25.0

### Patch Changes

- @voyantjs/core@0.25.0
- @voyantjs/db@0.25.0
- @voyantjs/hono@0.25.0

## 0.24.3

### Patch Changes

- @voyantjs/core@0.24.3
- @voyantjs/db@0.24.3
- @voyantjs/hono@0.24.3

## 0.24.2

### Patch Changes

- bec0471: Export the BookingJourney Hono route factory and module from the catalog package root, matching the route-module import pattern used by the vertical packages.
  - @voyantjs/core@0.24.2
  - @voyantjs/db@0.24.2
  - @voyantjs/hono@0.24.2

## 0.24.1

### Patch Changes

- 2d6297d: Expose a reusable BookingJourney Hono route module for the catalog booking engine.
  - @voyantjs/core@0.24.1
  - @voyantjs/db@0.24.1
  - @voyantjs/hono@0.24.1

## 0.24.0

### Patch Changes

- @voyantjs/core@0.24.0
- @voyantjs/db@0.24.0

## 0.23.0

### Patch Changes

- @voyantjs/core@0.23.0
- @voyantjs/db@0.23.0

## 0.22.0

### Patch Changes

- @voyantjs/core@0.22.0
- @voyantjs/db@0.22.0

## 0.21.1

### Patch Changes

- @voyantjs/core@0.21.1
- @voyantjs/db@0.21.1

## 0.21.0

### Minor Changes

- 6427bad: Release the booking journey architecture train.

  This adds booking hold policy support, richer traveler and booking journey flows, operator tax policy configuration, finance billing and tax policy APIs, notification reminder target and delivery tooling, and the template/runtime wiring needed for the operator storefront checkout flow.

### Patch Changes

- Updated dependencies [6427bad]
  - @voyantjs/core@0.21.0
  - @voyantjs/db@0.21.0

## 0.20.0

### Patch Changes

- @voyantjs/core@0.20.0
- @voyantjs/db@0.20.0
