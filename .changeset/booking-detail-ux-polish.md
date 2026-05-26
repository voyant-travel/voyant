---
"@voyantjs/bookings": patch
"@voyantjs/bookings-react": patch
"@voyantjs/bookings-ui": patch
"@voyantjs/catalog": patch
"@voyantjs/checkout-ui": patch
"@voyantjs/finance": patch
"@voyantjs/finance-react": patch
"@voyantjs/finance-ui": patch
"@voyantjs/i18n": patch
"@voyantjs/legal": patch
"@voyantjs/plugin-smartbill": patch
"@voyantjs/products": patch
"@voyantjs/ui": patch
---

Operator-dashboard booking-detail UX polish + finance refactors.

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
- Bookings list excludeStatuses filter (string-or-array) parsed by `bookingListQuerySchema`.
- `BookingPaymentsSummary` adds an FX equivalent column with `baseCurrency` + `baseAmountCents` plumbed through `publicFinanceBookingPaymentSchema` and the operator `useAdminBookingPayments` projection.
- Currency combobox now correctly disables (forwards `disabled` to the inner input and hides the clear button when disabled).
- New shared primitives in `@voyantjs/bookings-ui`: `IconActionButton` (icon button with built-in tooltip) and `StatusBadge` (semantic tone mapping for status strings) — exported from the package root.
