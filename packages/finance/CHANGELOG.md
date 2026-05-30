# @voyantjs/finance

## 0.85.1

### Patch Changes

- @voyantjs/action-ledger@0.85.1
- @voyantjs/bookings@0.85.1
- @voyantjs/core@0.85.1
- @voyantjs/db@0.85.1
- @voyantjs/hono@0.85.1
- @voyantjs/products@0.85.1
- @voyantjs/storage@0.85.1
- @voyantjs/utils@0.85.1

## 0.85.0

### Patch Changes

- @voyantjs/action-ledger@0.85.0
- @voyantjs/bookings@0.85.0
- @voyantjs/core@0.85.0
- @voyantjs/db@0.85.0
- @voyantjs/hono@0.85.0
- @voyantjs/products@0.85.0
- @voyantjs/storage@0.85.0
- @voyantjs/utils@0.85.0

## 0.84.4

### Patch Changes

- f3f8de1: Return a structured conflict response when proforma conversion attempts to reuse an active final invoice number, preserving the original proforma instead of surfacing a generic server error.
  - @voyantjs/action-ledger@0.84.4
  - @voyantjs/bookings@0.84.4
  - @voyantjs/core@0.84.4
  - @voyantjs/db@0.84.4
  - @voyantjs/hono@0.84.4
  - @voyantjs/products@0.84.4
  - @voyantjs/storage@0.84.4
  - @voyantjs/utils@0.84.4

## 0.84.3

### Patch Changes

- Updated dependencies [9eadf50]
  - @voyantjs/action-ledger@0.84.3
  - @voyantjs/bookings@0.84.3
  - @voyantjs/core@0.84.3
  - @voyantjs/db@0.84.3
  - @voyantjs/hono@0.84.3
  - @voyantjs/products@0.84.3
  - @voyantjs/storage@0.84.3
  - @voyantjs/utils@0.84.3

## 0.84.2

### Patch Changes

- @voyantjs/action-ledger@0.84.2
- @voyantjs/bookings@0.84.2
- @voyantjs/core@0.84.2
- @voyantjs/db@0.84.2
- @voyantjs/hono@0.84.2
- @voyantjs/products@0.84.2
- @voyantjs/storage@0.84.2
- @voyantjs/utils@0.84.2

## 0.84.1

### Patch Changes

- Updated dependencies [b9ef614]
  - @voyantjs/action-ledger@0.84.1
  - @voyantjs/bookings@0.84.1
  - @voyantjs/core@0.84.1
  - @voyantjs/db@0.84.1
  - @voyantjs/hono@0.84.1
  - @voyantjs/products@0.84.1
  - @voyantjs/storage@0.84.1
  - @voyantjs/utils@0.84.1

## 0.84.0

### Minor Changes

- 4ea42b3: Add tokenized public document delivery grants, a public document download route, and opt-in public download envelopes for generated finance and legal documents.

### Patch Changes

- Updated dependencies [4ea42b3]
  - @voyantjs/action-ledger@0.84.0
  - @voyantjs/bookings@0.84.0
  - @voyantjs/core@0.84.0
  - @voyantjs/db@0.84.0
  - @voyantjs/hono@0.84.0
  - @voyantjs/products@0.84.0
  - @voyantjs/storage@0.84.0
  - @voyantjs/utils@0.84.0

## 0.83.1

### Patch Changes

- @voyantjs/action-ledger@0.83.1
- @voyantjs/bookings@0.83.1
- @voyantjs/core@0.83.1
- @voyantjs/db@0.83.1
- @voyantjs/hono@0.83.1
- @voyantjs/products@0.83.1
- @voyantjs/storage@0.83.1
- @voyantjs/utils@0.83.1

## 0.83.0

### Patch Changes

- @voyantjs/action-ledger@0.83.0
- @voyantjs/bookings@0.83.0
- @voyantjs/core@0.83.0
- @voyantjs/db@0.83.0
- @voyantjs/hono@0.83.0
- @voyantjs/products@0.83.0
- @voyantjs/storage@0.83.0
- @voyantjs/utils@0.83.0

## 0.82.1

### Patch Changes

- @voyantjs/action-ledger@0.82.1
- @voyantjs/bookings@0.82.1
- @voyantjs/core@0.82.1
- @voyantjs/db@0.82.1
- @voyantjs/hono@0.82.1
- @voyantjs/products@0.82.1
- @voyantjs/storage@0.82.1
- @voyantjs/utils@0.82.1

## 0.82.0

### Patch Changes

- 79ce168: Slot-detail / allocation / booking-sheet UX pass.

  - `AvailabilitySlotDetailPage`: status badge color-coded by tone (open=green, closed/sold-out=red), product-type badge, locale-formatted date range with timezone chip, financial KPI cards (Remaining/Initial Pax, Total, Paid + %, Outstanding + %, per-currency rollup), timeline-style Activity tab, `<dl>`-style Metadata tab, AlertDialog delete confirmation, host-driven Edit / Open Product / Create Booking actions.
  - Slot allocation grid: side-by-side Unallocated + resources layout kicks in at `lg:` instead of `xl:`; payment-status chip palette unchanged but Tailwind source paths now cover `@voyantjs/allocation-ui` in the operator template so the colors actually render.
  - `AvailabilitySlotsTab`: optional header / `asPanel` / `hideBulkDelete` / `bulkStatusSelect` props let hosts embed the slots table outside of a Tabs shell and replace the bulk Open/Close buttons with a single "Change status" select.
  - Allocation manifest now exposes `sellAmountCents` / `paidAmountCents` per booking (and `derivePaidAmountCents` is exported from `@voyantjs/availability`). `productOptionSchema` adds `sellCurrency` and `productType` so consumers can drive currency / badge UI off the catalog response.
  - `GET /v1/products/:id` joins `product_types` and returns `productType` alongside the product row via new `productsService.getProductByIdWithType`.
  - `BookingCreateDialog` → `BookingCreateSheet` (file + symbol + registry slug rename). Right-side wide sheet, departure picker disables when opened with a `defaultSlotId`, full-mode payment schedule defaults the due date to the departure day until the operator touches it, payment-schedule currency falls back through product → pricing → placeholder so the server's `invalid_payment_schedules` validator stops rejecting mismatched currencies, slot-allocation cache busted after create so new bookings appear without a manual refresh.
  - `BookingQuickViewSheet`: real Payer section (email/phone/language/website/address), card-per-traveler details (email/phone/language/special-requests/notes), per-traveler document list, and a collapsible "More info" that lazily calls the audit-logged reveal endpoint to surface DOB / nationality / document / dietary / accessibility / bed preference.
  - `ProductQuickViewSheet`: new component in `@voyantjs/products-ui` mirroring the booking quick view shape — cover image, booking/capacity mode badges, full description, dates, itinerary days (with location + description), options list with status badges, tags, "View full product" footer.
  - `AsyncCombobox` now forwards `disabled` to `ComboboxInput` so disabled comboboxes are actually uneditable.
  - `DataTable` selection checkboxes use bubble-phase `stopPropagation` (wrapped in a `<div>`) instead of `onClickCapture` — fixes the "checkbox doesn't fire" bug under base-ui's checkbox event flow.
  - `useBookingCreateMutation` consumers (sheet) invalidate `availabilityQueryKeys.slots()` after create.
  - `loadProductOptionUnits` in finance booking-create now uses the exported `toRows<T>` normalizer to handle both `drizzle-orm/postgres-js` and `drizzle-orm/node-postgres` return shapes.
  - Operator template: Availability nav item moved directly under Products; slot detail route hosts the new edit dialog, booking quick view, product quick view; Tailwind `@source` scans `@voyantjs/allocation-ui` dist + src.
  - I18n: en/ro keys added for `tabSlots: "List"` rename, slot detail Activity timeline filters, slot Meta block, "Change status", "Create booking", "Edit slot", traveler reveal labels, booking quick view payer.

- Updated dependencies [79ce168]
  - @voyantjs/action-ledger@0.82.0
  - @voyantjs/bookings@0.82.0
  - @voyantjs/core@0.82.0
  - @voyantjs/db@0.82.0
  - @voyantjs/hono@0.82.0
  - @voyantjs/products@0.82.0
  - @voyantjs/storage@0.82.0
  - @voyantjs/utils@0.82.0

## 0.81.21

### Patch Changes

- Updated dependencies [b9fb5b0]
  - @voyantjs/action-ledger@0.81.21
  - @voyantjs/bookings@0.81.21
  - @voyantjs/core@0.81.21
  - @voyantjs/db@0.81.21
  - @voyantjs/hono@0.81.21
  - @voyantjs/products@0.81.21
  - @voyantjs/storage@0.81.21
  - @voyantjs/utils@0.81.21

## 0.81.20

### Patch Changes

- Updated dependencies [e60a50d]
  - @voyantjs/action-ledger@0.81.20
  - @voyantjs/bookings@0.81.20
  - @voyantjs/core@0.81.20
  - @voyantjs/db@0.81.20
  - @voyantjs/hono@0.81.20
  - @voyantjs/products@0.81.20
  - @voyantjs/storage@0.81.20
  - @voyantjs/utils@0.81.20

## 0.81.19

### Patch Changes

- Updated dependencies [62e4be5]
  - @voyantjs/action-ledger@0.81.19
  - @voyantjs/bookings@0.81.19
  - @voyantjs/core@0.81.19
  - @voyantjs/db@0.81.19
  - @voyantjs/hono@0.81.19
  - @voyantjs/products@0.81.19
  - @voyantjs/storage@0.81.19
  - @voyantjs/utils@0.81.19

## 0.81.18

### Patch Changes

- @voyantjs/action-ledger@0.81.18
- @voyantjs/bookings@0.81.18
- @voyantjs/core@0.81.18
- @voyantjs/db@0.81.18
- @voyantjs/hono@0.81.18
- @voyantjs/products@0.81.18
- @voyantjs/storage@0.81.18
- @voyantjs/utils@0.81.18

## 0.81.17

### Patch Changes

- @voyantjs/action-ledger@0.81.17
- @voyantjs/bookings@0.81.17
- @voyantjs/core@0.81.17
- @voyantjs/db@0.81.17
- @voyantjs/hono@0.81.17
- @voyantjs/products@0.81.17
- @voyantjs/storage@0.81.17
- @voyantjs/utils@0.81.17

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
  - @voyantjs/action-ledger@0.81.16
  - @voyantjs/bookings@0.81.16
  - @voyantjs/core@0.81.16
  - @voyantjs/db@0.81.16
  - @voyantjs/hono@0.81.16
  - @voyantjs/products@0.81.16
  - @voyantjs/storage@0.81.16
  - @voyantjs/utils@0.81.16

## 0.81.15

### Patch Changes

- b6bc138: Add invoice-from-booking schedule line description format options for product-first and product-only legal line names.
  - @voyantjs/action-ledger@0.81.15
  - @voyantjs/bookings@0.81.15
  - @voyantjs/core@0.81.15
  - @voyantjs/db@0.81.15
  - @voyantjs/hono@0.81.15
  - @voyantjs/products@0.81.15
  - @voyantjs/storage@0.81.15
  - @voyantjs/utils@0.81.15

## 0.81.14

### Patch Changes

- 0a77ff9: Preserve booking item display context for invoice-from-booking payment schedule lines and expose invoice line description resolution through finance route runtime options.
  - @voyantjs/action-ledger@0.81.14
  - @voyantjs/bookings@0.81.14
  - @voyantjs/core@0.81.14
  - @voyantjs/db@0.81.14
  - @voyantjs/hono@0.81.14
  - @voyantjs/products@0.81.14
  - @voyantjs/storage@0.81.14
  - @voyantjs/utils@0.81.14

## 0.81.13

### Patch Changes

- Updated dependencies [28dca55]
  - @voyantjs/action-ledger@0.81.13
  - @voyantjs/bookings@0.81.13
  - @voyantjs/core@0.81.13
  - @voyantjs/db@0.81.13
  - @voyantjs/hono@0.81.13
  - @voyantjs/products@0.81.13
  - @voyantjs/storage@0.81.13
  - @voyantjs/utils@0.81.13

## 0.81.12

### Patch Changes

- @voyantjs/action-ledger@0.81.12
- @voyantjs/bookings@0.81.12
- @voyantjs/core@0.81.12
- @voyantjs/db@0.81.12
- @voyantjs/hono@0.81.12
- @voyantjs/products@0.81.12
- @voyantjs/storage@0.81.12
- @voyantjs/utils@0.81.12

## 0.81.11

### Patch Changes

- ef079f4: Allow voided invoices to release external invoice numbers for reissue and surface external allocation writeback conflicts on SmartBill refs.
  - @voyantjs/action-ledger@0.81.11
  - @voyantjs/bookings@0.81.11
  - @voyantjs/core@0.81.11
  - @voyantjs/db@0.81.11
  - @voyantjs/hono@0.81.11
  - @voyantjs/products@0.81.11
  - @voyantjs/storage@0.81.11
  - @voyantjs/utils@0.81.11

## 0.81.10

### Patch Changes

- 6c6a008: Preserve booking payment schedule context on invoice line items and issued invoice events.
  - @voyantjs/action-ledger@0.81.10
  - @voyantjs/bookings@0.81.10
  - @voyantjs/core@0.81.10
  - @voyantjs/db@0.81.10
  - @voyantjs/hono@0.81.10
  - @voyantjs/products@0.81.10
  - @voyantjs/storage@0.81.10
  - @voyantjs/utils@0.81.10

## 0.81.9

### Patch Changes

- 1a58939: Preserve billing contact address line 2 on booking snapshots and downstream documents.
- Updated dependencies [1a58939]
  - @voyantjs/action-ledger@0.81.9
  - @voyantjs/bookings@0.81.9
  - @voyantjs/core@0.81.9
  - @voyantjs/db@0.81.9
  - @voyantjs/hono@0.81.9
  - @voyantjs/products@0.81.9
  - @voyantjs/storage@0.81.9
  - @voyantjs/utils@0.81.9

## 0.81.8

### Patch Changes

- Updated dependencies [688ac4f]
  - @voyantjs/action-ledger@0.81.8
  - @voyantjs/bookings@0.81.8
  - @voyantjs/core@0.81.8
  - @voyantjs/db@0.81.8
  - @voyantjs/hono@0.81.8
  - @voyantjs/products@0.81.8
  - @voyantjs/storage@0.81.8
  - @voyantjs/utils@0.81.8

## 0.81.7

### Patch Changes

- Updated dependencies [410cd17]
  - @voyantjs/action-ledger@0.81.7
  - @voyantjs/bookings@0.81.7
  - @voyantjs/core@0.81.7
  - @voyantjs/db@0.81.7
  - @voyantjs/hono@0.81.7
  - @voyantjs/products@0.81.7
  - @voyantjs/storage@0.81.7
  - @voyantjs/utils@0.81.7

## 0.81.6

### Patch Changes

- @voyantjs/action-ledger@0.81.6
- @voyantjs/bookings@0.81.6
- @voyantjs/core@0.81.6
- @voyantjs/db@0.81.6
- @voyantjs/hono@0.81.6
- @voyantjs/products@0.81.6
- @voyantjs/storage@0.81.6
- @voyantjs/utils@0.81.6

## 0.81.5

### Patch Changes

- 7d8a977: Normalize legacy person-keyed accommodation booking-create item lines onto their inventory unit before item insertion, linking, and server-side draft verification.
  - @voyantjs/action-ledger@0.81.5
  - @voyantjs/bookings@0.81.5
  - @voyantjs/core@0.81.5
  - @voyantjs/db@0.81.5
  - @voyantjs/hono@0.81.5
  - @voyantjs/products@0.81.5
  - @voyantjs/storage@0.81.5
  - @voyantjs/utils@0.81.5

## 0.81.4

### Patch Changes

- 6daefc4: Add stable booking-create traveler keys for item and extra line traveler linkage, while keeping deprecated position-based traveler indexes as a transition fallback.
- Updated dependencies [6daefc4]
  - @voyantjs/action-ledger@0.81.4
  - @voyantjs/bookings@0.81.4
  - @voyantjs/core@0.81.4
  - @voyantjs/db@0.81.4
  - @voyantjs/hono@0.81.4
  - @voyantjs/products@0.81.4
  - @voyantjs/storage@0.81.4
  - @voyantjs/utils@0.81.4

## 0.81.3

### Patch Changes

- Updated dependencies [f157bcd]
  - @voyantjs/action-ledger@0.81.3
  - @voyantjs/bookings@0.81.3
  - @voyantjs/core@0.81.3
  - @voyantjs/db@0.81.3
  - @voyantjs/hono@0.81.3
  - @voyantjs/products@0.81.3
  - @voyantjs/storage@0.81.3
  - @voyantjs/utils@0.81.3

## 0.81.2

### Patch Changes

- @voyantjs/action-ledger@0.81.2
- @voyantjs/bookings@0.81.2
- @voyantjs/core@0.81.2
- @voyantjs/db@0.81.2
- @voyantjs/hono@0.81.2
- @voyantjs/products@0.81.2
- @voyantjs/storage@0.81.2
- @voyantjs/utils@0.81.2

## 0.81.1

### Patch Changes

- 2ce08ff: Emit a distinct proforma conversion event, convert SmartBill estimates into invoices instead of issuing duplicates, and reject new payments against void invoices.
  - @voyantjs/action-ledger@0.81.1
  - @voyantjs/bookings@0.81.1
  - @voyantjs/core@0.81.1
  - @voyantjs/db@0.81.1
  - @voyantjs/hono@0.81.1
  - @voyantjs/products@0.81.1
  - @voyantjs/storage@0.81.1
  - @voyantjs/utils@0.81.1

## 0.81.0

### Minor Changes

- f35e63c: Separate inventory units (rooms, vehicles) from pricing tiers (Adult / Child / Infant) in the booking-create flow. RFC voyantjs/voyant#1267.

  ## What changed

  ### `@voyantjs/bookings` — new `./pricing-assignment` sub-path

  Single source of truth for traveler→option-unit mapping, transport-agnostic. The booking-create dialog (preview + submit) is the only call site today; the server-side submit validation pathway is a follow-up — but the module is now placed where that wiring is straightforward:

  ```ts
  import {
    resolveBookingDraft,
    resolveBookingExtraLines,
  } from "@voyantjs/bookings/pricing-assignment";
  ```

  `resolveBookingDraft` distinguishes **person-priced options** (excursions — line quantities derive from travelers) from **accommodation options** (rooms — quantities stay as the operator picked them). Returns `{ quantities, travelers, travelerIndexesByUnitId }` so submit can write `booking_item_travelers` linkage.

  `resolveBookingExtraLines` normalizes per-person extras to charged traveler quantity and stamps `travelerIndexes` so each extra line gets linked to the travelers it applies to.

  A new `roomUnitAssignmentSource: "auto" | "manual" | "none"` enum on the in-memory traveler tracks operator intent declaratively (was a one-shot `useRef` ratchet). `none` = explicit "No room" survives resolver re-runs; `auto` is re-derived; `manual` is preserved while the unit is still in the current option set.

  ### Wire format additions on `BookingCreateItemLineInput` / `BookingCreateExtraLineInput`

  - `clientLineKey?: string | null` — stable client-side key the server stamps into `booking_items.metadata.bookingCreateLineKey` for post-insert lookup.
  - `travelerIndexes?: number[] | null` — indexes (into the request's `travelers` array) the item/extra applies to. Server inserts one row in the existing `booking_item_travelers` join table per (item, traveler) pair.

  `roomUnitId` on each traveler is unchanged on the wire — current dialogs keep working without modification.

  ### `@voyantjs/finance` — orchestrator links items to travelers

  `POST /v1/bookings/create`: after travelers + items are inserted, the orchestrator looks up each item by its stamped `metadata.bookingCreateLineKey` and writes one `booking_item_travelers` row per requested traveler. Idempotent (dedupes by `(item_id, traveler_id)`), skips silently when the converter didn't produce an item for that key.

  ### `@voyantjs/bookings-ui` — resolver-driven dialog

  - Dropped the locally-defined `pickUnitForAge` / `redistributeByAge` (moved to the assignment module in Phase 2).
  - `displayQuantities` + submit both go through `resolveBookingDraft`. `displayExtraLines` (preview) + submit extras both go through `resolveBookingExtraLines`. No more drift.
  - The submit pipeline sends `clientLineKey` + `travelerIndexes` on every item and per-person extra so the server can link them.
  - `TravelerEntry` gains `roomUnitAssignmentSource`; category/Room/person-picker handlers set it explicitly (`manual` / `none` / `auto`).
  - Dropped the one-shot hydration `useRef` from #1265 — the source enum + resolver re-derivation handle the race + "No room" disambiguation declaratively.

  ### Architecture doc

  `docs/architecture/booking-journey-architecture.md` now codifies the invariant: traveler age/pricing band, sellable option unit, room/accommodation assignment, and explicit "no room" intent are separate draft concepts; preview totals and submit payloads must be derived from the same resolver; item/extra applicability is persisted through `booking_item_travelers`, not inferred from labels or counts. This prevents future regressions of the bug class behind #1234 / #1239 / #1262.

  ## Why this shape (vs. adding columns to `booking_travelers`)

  The `booking_item_travelers` join table already existed for participant↔item linkage. Using it for unit assignment leverages a tool that was already in the codebase — no schema migration needed, and the model naturally handles cases where one traveler is linked to several items (room + per-pax extra + ...). Adding `pricing_unit_id` / `inventory_unit_id` columns directly to `booking_travelers` (the original plan in #1267 / earlier iterations of this PR) would have been a denormalization of what the join table already expresses.

  ## Backwards compatibility

  - Existing wire-format clients that send `roomUnitId` on each traveler keep working — the server still accepts it (round-trips through, no behavioral change).
  - New clients should send `pricingUnitId` semantics through `itemLines[].travelerIndexes` (the join-table model). The current dialog still uses `roomUnitId` internally; that's fine, the resolver bridges.
  - No database migration. Pre-existing `booking_item_travelers` data is unaffected.

### Patch Changes

- Updated dependencies [f35e63c]
  - @voyantjs/action-ledger@0.81.0
  - @voyantjs/bookings@0.81.0
  - @voyantjs/core@0.81.0
  - @voyantjs/db@0.81.0
  - @voyantjs/hono@0.81.0
  - @voyantjs/products@0.81.0
  - @voyantjs/storage@0.81.0
  - @voyantjs/utils@0.81.0

## 0.80.18

### Patch Changes

- @voyantjs/action-ledger@0.80.18
- @voyantjs/bookings@0.80.18
- @voyantjs/core@0.80.18
- @voyantjs/db@0.80.18
- @voyantjs/hono@0.80.18
- @voyantjs/products@0.80.18
- @voyantjs/storage@0.80.18
- @voyantjs/utils@0.80.18

## 0.80.17

### Patch Changes

- @voyantjs/action-ledger@0.80.17
- @voyantjs/bookings@0.80.17
- @voyantjs/core@0.80.17
- @voyantjs/db@0.80.17
- @voyantjs/hono@0.80.17
- @voyantjs/products@0.80.17
- @voyantjs/storage@0.80.17
- @voyantjs/utils@0.80.17

## 0.80.16

### Patch Changes

- dbcc0da: Add admin invoice voiding and route finance admin clients through `/v1/admin/finance`.
  - @voyantjs/action-ledger@0.80.16
  - @voyantjs/bookings@0.80.16
  - @voyantjs/core@0.80.16
  - @voyantjs/db@0.80.16
  - @voyantjs/hono@0.80.16
  - @voyantjs/products@0.80.16
  - @voyantjs/storage@0.80.16
  - @voyantjs/utils@0.80.16

## 0.80.15

### Patch Changes

- Updated dependencies [0d8d14e]
  - @voyantjs/action-ledger@0.80.15
  - @voyantjs/bookings@0.80.15
  - @voyantjs/core@0.80.15
  - @voyantjs/db@0.80.15
  - @voyantjs/hono@0.80.15
  - @voyantjs/products@0.80.15
  - @voyantjs/storage@0.80.15
  - @voyantjs/utils@0.80.15

## 0.80.14

### Patch Changes

- @voyantjs/action-ledger@0.80.14
- @voyantjs/bookings@0.80.14
- @voyantjs/core@0.80.14
- @voyantjs/db@0.80.14
- @voyantjs/hono@0.80.14
- @voyantjs/products@0.80.14
- @voyantjs/storage@0.80.14
- @voyantjs/utils@0.80.14

## 0.80.13

### Patch Changes

- 55d99af: Assert invoice line item persistence when creating invoices from bookings.
  - @voyantjs/action-ledger@0.80.13
  - @voyantjs/bookings@0.80.13
  - @voyantjs/core@0.80.13
  - @voyantjs/db@0.80.13
  - @voyantjs/hono@0.80.13
  - @voyantjs/products@0.80.13
  - @voyantjs/storage@0.80.13
  - @voyantjs/utils@0.80.13

## 0.80.12

### Patch Changes

- @voyantjs/action-ledger@0.80.12
- @voyantjs/bookings@0.80.12
- @voyantjs/core@0.80.12
- @voyantjs/db@0.80.12
- @voyantjs/hono@0.80.12
- @voyantjs/products@0.80.12
- @voyantjs/storage@0.80.12
- @voyantjs/utils@0.80.12

## 0.80.11

### Patch Changes

- @voyantjs/action-ledger@0.80.11
- @voyantjs/bookings@0.80.11
- @voyantjs/core@0.80.11
- @voyantjs/db@0.80.11
- @voyantjs/hono@0.80.11
- @voyantjs/products@0.80.11
- @voyantjs/storage@0.80.11
- @voyantjs/utils@0.80.11

## 0.80.10

### Patch Changes

- @voyantjs/action-ledger@0.80.10
- @voyantjs/bookings@0.80.10
- @voyantjs/core@0.80.10
- @voyantjs/db@0.80.10
- @voyantjs/hono@0.80.10
- @voyantjs/products@0.80.10
- @voyantjs/storage@0.80.10
- @voyantjs/utils@0.80.10

## 0.80.9

### Patch Changes

- Updated dependencies [37aa8b6]
  - @voyantjs/action-ledger@0.80.9
  - @voyantjs/bookings@0.80.9
  - @voyantjs/core@0.80.9
  - @voyantjs/db@0.80.9
  - @voyantjs/hono@0.80.9
  - @voyantjs/products@0.80.9
  - @voyantjs/storage@0.80.9
  - @voyantjs/utils@0.80.9

## 0.80.8

### Patch Changes

- 6ba4515: Allow invoice-from-booking requests to pre-seed invoice external refs before issued events run.
  - @voyantjs/action-ledger@0.80.8
  - @voyantjs/bookings@0.80.8
  - @voyantjs/core@0.80.8
  - @voyantjs/db@0.80.8
  - @voyantjs/hono@0.80.8
  - @voyantjs/products@0.80.8
  - @voyantjs/storage@0.80.8
  - @voyantjs/utils@0.80.8

## 0.80.7

### Patch Changes

- e16eb2f: Allow invoice-from-booking requests to override invoice currency and line items while validating external fiscal totals.
  - @voyantjs/action-ledger@0.80.7
  - @voyantjs/bookings@0.80.7
  - @voyantjs/core@0.80.7
  - @voyantjs/db@0.80.7
  - @voyantjs/hono@0.80.7
  - @voyantjs/products@0.80.7
  - @voyantjs/storage@0.80.7
  - @voyantjs/utils@0.80.7

## 0.80.6

### Patch Changes

- f7df51b: Bump the Voyant Data SDK dependency to avoid the consumer-side global this runtime issue.
  - @voyantjs/action-ledger@0.80.6
  - @voyantjs/bookings@0.80.6
  - @voyantjs/core@0.80.6
  - @voyantjs/db@0.80.6
  - @voyantjs/hono@0.80.6
  - @voyantjs/products@0.80.6
  - @voyantjs/storage@0.80.6
  - @voyantjs/utils@0.80.6

## 0.80.5

### Patch Changes

- f27b01f: Validate booking-create payment schedule currencies and confirmed totals before persisting schedules.
- d1ae342: Auto-compute base amounts for cross-currency finance records using configured FX commission and persisted rate-set links.
  - @voyantjs/action-ledger@0.80.5
  - @voyantjs/bookings@0.80.5
  - @voyantjs/core@0.80.5
  - @voyantjs/db@0.80.5
  - @voyantjs/hono@0.80.5
  - @voyantjs/products@0.80.5
  - @voyantjs/storage@0.80.5
  - @voyantjs/utils@0.80.5

## 0.80.4

### Patch Changes

- a411b1c: Use `@voyantjs/data-sdk` for the Voyant Data FX resolver and expose optional FX provenance fields.
  - @voyantjs/action-ledger@0.80.4
  - @voyantjs/bookings@0.80.4
  - @voyantjs/core@0.80.4
  - @voyantjs/db@0.80.4
  - @voyantjs/hono@0.80.4
  - @voyantjs/products@0.80.4
  - @voyantjs/storage@0.80.4
  - @voyantjs/utils@0.80.4

## 0.80.3

### Patch Changes

- 6d816bb: Add `Idempotency-Key` replay support to admin create routes for CRM people and organizations, finance invoices, and legal contracts.
- Updated dependencies [6d816bb]
  - @voyantjs/action-ledger@0.80.3
  - @voyantjs/bookings@0.80.3
  - @voyantjs/core@0.80.3
  - @voyantjs/db@0.80.3
  - @voyantjs/hono@0.80.3
  - @voyantjs/products@0.80.3
  - @voyantjs/storage@0.80.3
  - @voyantjs/utils@0.80.3

## 0.80.2

### Patch Changes

- Updated dependencies [7a94871]
- Updated dependencies [9d6be13]
  - @voyantjs/action-ledger@0.80.2
  - @voyantjs/bookings@0.80.2
  - @voyantjs/core@0.80.2
  - @voyantjs/db@0.80.2
  - @voyantjs/hono@0.80.2
  - @voyantjs/products@0.80.2
  - @voyantjs/storage@0.80.2
  - @voyantjs/utils@0.80.2

## 0.80.1

### Patch Changes

- @voyantjs/action-ledger@0.80.1
- @voyantjs/bookings@0.80.1
- @voyantjs/core@0.80.1
- @voyantjs/db@0.80.1
- @voyantjs/hono@0.80.1
- @voyantjs/products@0.80.1
- @voyantjs/storage@0.80.1
- @voyantjs/utils@0.80.1

## 0.80.0

### Minor Changes

- 9473eb8: Add booking checkout URL helpers and operator-facing URL template labels for booking checkout/payment links.

### Patch Changes

- @voyantjs/action-ledger@0.80.0
- @voyantjs/bookings@0.80.0
- @voyantjs/core@0.80.0
- @voyantjs/db@0.80.0
- @voyantjs/hono@0.80.0
- @voyantjs/products@0.80.0
- @voyantjs/storage@0.80.0
- @voyantjs/utils@0.80.0

## 0.79.0

### Patch Changes

- @voyantjs/action-ledger@0.79.0
- @voyantjs/bookings@0.79.0
- @voyantjs/core@0.79.0
- @voyantjs/db@0.79.0
- @voyantjs/hono@0.79.0
- @voyantjs/products@0.79.0
- @voyantjs/storage@0.79.0
- @voyantjs/utils@0.79.0

## 0.78.0

### Patch Changes

- @voyantjs/action-ledger@0.78.0
- @voyantjs/bookings@0.78.0
- @voyantjs/core@0.78.0
- @voyantjs/db@0.78.0
- @voyantjs/hono@0.78.0
- @voyantjs/products@0.78.0
- @voyantjs/storage@0.78.0
- @voyantjs/utils@0.78.0

## 0.77.13

### Patch Changes

- 70a32ab: Add SmartBill admin invoice sync helpers, Hono routes, and default invoice panel actions.
  - @voyantjs/action-ledger@0.77.13
  - @voyantjs/bookings@0.77.13
  - @voyantjs/core@0.77.13
  - @voyantjs/db@0.77.13
  - @voyantjs/hono@0.77.13
  - @voyantjs/products@0.77.13
  - @voyantjs/storage@0.77.13
  - @voyantjs/utils@0.77.13

## 0.77.12

### Patch Changes

- bf74cd4: Rename the invoice issuance status from `sent` to `issued`.
  - @voyantjs/action-ledger@0.77.12
  - @voyantjs/bookings@0.77.12
  - @voyantjs/core@0.77.12
  - @voyantjs/db@0.77.12
  - @voyantjs/hono@0.77.12
  - @voyantjs/products@0.77.12
  - @voyantjs/storage@0.77.12
  - @voyantjs/utils@0.77.12

## 0.77.11

### Patch Changes

- 437fb58: Allow invoice numbers to repeat across distinct finance document types while preserving same-type uniqueness.
  - @voyantjs/action-ledger@0.77.11
  - @voyantjs/bookings@0.77.11
  - @voyantjs/core@0.77.11
  - @voyantjs/db@0.77.11
  - @voyantjs/hono@0.77.11
  - @voyantjs/products@0.77.11
  - @voyantjs/storage@0.77.11
  - @voyantjs/utils@0.77.11

## 0.77.10

### Patch Changes

- 5751c4e: Let schedule-row invoice actions use server-side invoice number allocation and return conflicts for duplicate manual invoice numbers.
  - @voyantjs/action-ledger@0.77.10
  - @voyantjs/bookings@0.77.10
  - @voyantjs/core@0.77.10
  - @voyantjs/db@0.77.10
  - @voyantjs/hono@0.77.10
  - @voyantjs/products@0.77.10
  - @voyantjs/storage@0.77.10
  - @voyantjs/utils@0.77.10

## 0.77.9

### Patch Changes

- 10e3ed5: Create booking invoices from a targeted payment schedule row when one is provided.
  - @voyantjs/action-ledger@0.77.9
  - @voyantjs/bookings@0.77.9
  - @voyantjs/core@0.77.9
  - @voyantjs/db@0.77.9
  - @voyantjs/hono@0.77.9
  - @voyantjs/products@0.77.9
  - @voyantjs/storage@0.77.9
  - @voyantjs/utils@0.77.9

## 0.77.8

### Patch Changes

- @voyantjs/action-ledger@0.77.8
- @voyantjs/bookings@0.77.8
- @voyantjs/core@0.77.8
- @voyantjs/db@0.77.8
- @voyantjs/hono@0.77.8
- @voyantjs/products@0.77.8
- @voyantjs/storage@0.77.8
- @voyantjs/utils@0.77.8

## 0.77.7

### Patch Changes

- @voyantjs/action-ledger@0.77.7
- @voyantjs/bookings@0.77.7
- @voyantjs/core@0.77.7
- @voyantjs/db@0.77.7
- @voyantjs/hono@0.77.7
- @voyantjs/products@0.77.7
- @voyantjs/storage@0.77.7
- @voyantjs/utils@0.77.7

## 0.77.6

### Patch Changes

- @voyantjs/action-ledger@0.77.6
- @voyantjs/bookings@0.77.6
- @voyantjs/core@0.77.6
- @voyantjs/db@0.77.6
- @voyantjs/hono@0.77.6
- @voyantjs/products@0.77.6
- @voyantjs/storage@0.77.6
- @voyantjs/utils@0.77.6

## 0.77.5

### Patch Changes

- 6e522cb: Carry resolved tax names and regime codes on issued invoice event line items for downstream integrations.
  - @voyantjs/action-ledger@0.77.5
  - @voyantjs/bookings@0.77.5
  - @voyantjs/core@0.77.5
  - @voyantjs/db@0.77.5
  - @voyantjs/hono@0.77.5
  - @voyantjs/products@0.77.5
  - @voyantjs/storage@0.77.5
  - @voyantjs/utils@0.77.5

## 0.77.4

### Patch Changes

- @voyantjs/action-ledger@0.77.4
- @voyantjs/bookings@0.77.4
- @voyantjs/core@0.77.4
- @voyantjs/db@0.77.4
- @voyantjs/hono@0.77.4
- @voyantjs/products@0.77.4
- @voyantjs/storage@0.77.4
- @voyantjs/utils@0.77.4

## 0.77.3

### Patch Changes

- @voyantjs/action-ledger@0.77.3
- @voyantjs/bookings@0.77.3
- @voyantjs/core@0.77.3
- @voyantjs/db@0.77.3
- @voyantjs/hono@0.77.3
- @voyantjs/products@0.77.3
- @voyantjs/storage@0.77.3
- @voyantjs/utils@0.77.3

## 0.77.2

### Patch Changes

- @voyantjs/action-ledger@0.77.2
- @voyantjs/bookings@0.77.2
- @voyantjs/core@0.77.2
- @voyantjs/db@0.77.2
- @voyantjs/hono@0.77.2
- @voyantjs/products@0.77.2
- @voyantjs/storage@0.77.2
- @voyantjs/utils@0.77.2

## 0.77.1

### Patch Changes

- 574684d: Derive booking-create pax from supplied travelers when pax is omitted, while preserving explicit pax values.
- Updated dependencies [574684d]
  - @voyantjs/action-ledger@0.77.1
  - @voyantjs/bookings@0.77.1
  - @voyantjs/core@0.77.1
  - @voyantjs/db@0.77.1
  - @voyantjs/hono@0.77.1
  - @voyantjs/products@0.77.1
  - @voyantjs/storage@0.77.1
  - @voyantjs/utils@0.77.1

## 0.77.0

### Minor Changes

- 1da934d: Share stored-document download envelope resolution and include signed download envelopes with filenames in finance and legal document-generation responses.

### Patch Changes

- Updated dependencies [1da934d]
  - @voyantjs/action-ledger@0.77.0
  - @voyantjs/bookings@0.77.0
  - @voyantjs/core@0.77.0
  - @voyantjs/db@0.77.0
  - @voyantjs/hono@0.77.0
  - @voyantjs/products@0.77.0
  - @voyantjs/storage@0.77.0
  - @voyantjs/utils@0.77.0

## 0.76.0

### Minor Changes

- abf673d: Add bounded invoice rendition wait responses with inline document download URLs for interactive finance flows.

### Patch Changes

- @voyantjs/action-ledger@0.76.0
- @voyantjs/bookings@0.76.0
- @voyantjs/core@0.76.0
- @voyantjs/db@0.76.0
- @voyantjs/hono@0.76.0
- @voyantjs/products@0.76.0
- @voyantjs/storage@0.76.0
- @voyantjs/utils@0.76.0

## 0.75.7

### Patch Changes

- 827c25e: Allow invoice-from-booking calls to omit `invoiceNumber`, allocate numbers from active/default series, and hand external-provider series to SmartBill-style adapters for provider-owned numbering.
  - @voyantjs/action-ledger@0.75.7
  - @voyantjs/bookings@0.75.7
  - @voyantjs/core@0.75.7
  - @voyantjs/db@0.75.7
  - @voyantjs/hono@0.75.7
  - @voyantjs/products@0.75.7
  - @voyantjs/storage@0.75.7
  - @voyantjs/utils@0.75.7

## 0.75.6

### Patch Changes

- @voyantjs/action-ledger@0.75.6
- @voyantjs/bookings@0.75.6
- @voyantjs/core@0.75.6
- @voyantjs/db@0.75.6
- @voyantjs/hono@0.75.6
- @voyantjs/products@0.75.6
- @voyantjs/storage@0.75.6
- @voyantjs/utils@0.75.6

## 0.75.5

### Patch Changes

- 84a32bb: Require linked completed payment coverage before booking payment schedules can become paid.
- 192c9aa: Allow booking creation payloads with a billing person to use a phone number as the required contact channel when no real email is available.
  - @voyantjs/action-ledger@0.75.5
  - @voyantjs/bookings@0.75.5
  - @voyantjs/core@0.75.5
  - @voyantjs/db@0.75.5
  - @voyantjs/hono@0.75.5
  - @voyantjs/products@0.75.5
  - @voyantjs/storage@0.75.5
  - @voyantjs/utils@0.75.5

## 0.75.4

### Patch Changes

- @voyantjs/action-ledger@0.75.4
- @voyantjs/bookings@0.75.4
- @voyantjs/core@0.75.4
- @voyantjs/db@0.75.4
- @voyantjs/hono@0.75.4
- @voyantjs/products@0.75.4
- @voyantjs/storage@0.75.4
- @voyantjs/utils@0.75.4

## 0.75.3

### Patch Changes

- @voyantjs/action-ledger@0.75.3
- @voyantjs/bookings@0.75.3
- @voyantjs/core@0.75.3
- @voyantjs/db@0.75.3
- @voyantjs/hono@0.75.3
- @voyantjs/products@0.75.3
- @voyantjs/storage@0.75.3
- @voyantjs/utils@0.75.3

## 0.75.2

### Patch Changes

- @voyantjs/action-ledger@0.75.2
- @voyantjs/bookings@0.75.2
- @voyantjs/core@0.75.2
- @voyantjs/db@0.75.2
- @voyantjs/hono@0.75.2
- @voyantjs/products@0.75.2
- @voyantjs/storage@0.75.2
- @voyantjs/utils@0.75.2

## 0.75.1

### Patch Changes

- @voyantjs/action-ledger@0.75.1
- @voyantjs/bookings@0.75.1
- @voyantjs/core@0.75.1
- @voyantjs/db@0.75.1
- @voyantjs/hono@0.75.1
- @voyantjs/products@0.75.1
- @voyantjs/storage@0.75.1
- @voyantjs/utils@0.75.1

## 0.75.0

### Patch Changes

- Updated dependencies [1eab599]
  - @voyantjs/action-ledger@0.75.0
  - @voyantjs/bookings@0.75.0
  - @voyantjs/core@0.75.0
  - @voyantjs/db@0.75.0
  - @voyantjs/hono@0.75.0
  - @voyantjs/products@0.75.0
  - @voyantjs/storage@0.75.0
  - @voyantjs/utils@0.75.0

## 0.74.2

### Patch Changes

- Updated dependencies [37c08cd]
  - @voyantjs/action-ledger@0.74.2
  - @voyantjs/bookings@0.74.2
  - @voyantjs/core@0.74.2
  - @voyantjs/db@0.74.2
  - @voyantjs/hono@0.74.2
  - @voyantjs/products@0.74.2
  - @voyantjs/storage@0.74.2
  - @voyantjs/utils@0.74.2

## 0.74.1

### Patch Changes

- 225a483: Auto-fill cross-currency booking payment FX rates from the configured Voyant Data FX resolver.
  - @voyantjs/action-ledger@0.74.1
  - @voyantjs/bookings@0.74.1
  - @voyantjs/core@0.74.1
  - @voyantjs/db@0.74.1
  - @voyantjs/hono@0.74.1
  - @voyantjs/products@0.74.1
  - @voyantjs/storage@0.74.1
  - @voyantjs/utils@0.74.1

## 0.74.0

### Patch Changes

- @voyantjs/action-ledger@0.74.0
- @voyantjs/bookings@0.74.0
- @voyantjs/core@0.74.0
- @voyantjs/db@0.74.0
- @voyantjs/hono@0.74.0
- @voyantjs/products@0.74.0
- @voyantjs/storage@0.74.0
- @voyantjs/utils@0.74.0

## 0.73.1

### Patch Changes

- @voyantjs/action-ledger@0.73.1
- @voyantjs/bookings@0.73.1
- @voyantjs/core@0.73.1
- @voyantjs/db@0.73.1
- @voyantjs/hono@0.73.1
- @voyantjs/products@0.73.1
- @voyantjs/storage@0.73.1
- @voyantjs/utils@0.73.1

## 0.73.0

### Patch Changes

- @voyantjs/action-ledger@0.73.0
- @voyantjs/bookings@0.73.0
- @voyantjs/core@0.73.0
- @voyantjs/db@0.73.0
- @voyantjs/hono@0.73.0
- @voyantjs/products@0.73.0
- @voyantjs/storage@0.73.0
- @voyantjs/utils@0.73.0

## 0.72.0

### Patch Changes

- @voyantjs/action-ledger@0.72.0
- @voyantjs/bookings@0.72.0
- @voyantjs/core@0.72.0
- @voyantjs/db@0.72.0
- @voyantjs/hono@0.72.0
- @voyantjs/products@0.72.0
- @voyantjs/storage@0.72.0
- @voyantjs/utils@0.72.0

## 0.71.0

### Patch Changes

- @voyantjs/action-ledger@0.71.0
- @voyantjs/bookings@0.71.0
- @voyantjs/core@0.71.0
- @voyantjs/db@0.71.0
- @voyantjs/hono@0.71.0
- @voyantjs/products@0.71.0
- @voyantjs/storage@0.71.0
- @voyantjs/utils@0.71.0

## 0.70.0

### Patch Changes

- @voyantjs/action-ledger@0.70.0
- @voyantjs/bookings@0.70.0
- @voyantjs/core@0.70.0
- @voyantjs/db@0.70.0
- @voyantjs/hono@0.70.0
- @voyantjs/products@0.70.0
- @voyantjs/storage@0.70.0
- @voyantjs/utils@0.70.0

## 0.69.1

### Patch Changes

- @voyantjs/action-ledger@0.69.1
- @voyantjs/bookings@0.69.1
- @voyantjs/core@0.69.1
- @voyantjs/db@0.69.1
- @voyantjs/hono@0.69.1
- @voyantjs/products@0.69.1
- @voyantjs/storage@0.69.1
- @voyantjs/utils@0.69.1

## 0.69.0

### Patch Changes

- @voyantjs/action-ledger@0.69.0
- @voyantjs/bookings@0.69.0
- @voyantjs/core@0.69.0
- @voyantjs/db@0.69.0
- @voyantjs/hono@0.69.0
- @voyantjs/products@0.69.0
- @voyantjs/storage@0.69.0
- @voyantjs/utils@0.69.0

## 0.68.0

### Patch Changes

- @voyantjs/action-ledger@0.68.0
- @voyantjs/bookings@0.68.0
- @voyantjs/core@0.68.0
- @voyantjs/db@0.68.0
- @voyantjs/hono@0.68.0
- @voyantjs/products@0.68.0
- @voyantjs/storage@0.68.0
- @voyantjs/utils@0.68.0

## 0.67.0

### Patch Changes

- @voyantjs/action-ledger@0.67.0
- @voyantjs/bookings@0.67.0
- @voyantjs/core@0.67.0
- @voyantjs/db@0.67.0
- @voyantjs/hono@0.67.0
- @voyantjs/products@0.67.0
- @voyantjs/storage@0.67.0
- @voyantjs/utils@0.67.0

## 0.66.6

### Patch Changes

- 2a40d26: Add operator-configurable invoice FX settings, data FX exchange-rate resolution helpers, non-fatal invoice FX resolver error handling, invoice-issued event enrichment, and SmartBill exchange-rate mapping.
- Updated dependencies [f6634ff]
  - @voyantjs/action-ledger@0.66.6
  - @voyantjs/bookings@0.66.6
  - @voyantjs/core@0.66.6
  - @voyantjs/db@0.66.6
  - @voyantjs/hono@0.66.6
  - @voyantjs/products@0.66.6
  - @voyantjs/storage@0.66.6
  - @voyantjs/utils@0.66.6

## 0.66.5

### Patch Changes

- Updated dependencies [ee36ef5]
  - @voyantjs/action-ledger@0.66.5
  - @voyantjs/bookings@0.66.5
  - @voyantjs/core@0.66.5
  - @voyantjs/db@0.66.5
  - @voyantjs/hono@0.66.5
  - @voyantjs/products@0.66.5
  - @voyantjs/storage@0.66.5
  - @voyantjs/utils@0.66.5

## 0.66.4

### Patch Changes

- Updated dependencies [83ff2de]
  - @voyantjs/action-ledger@0.66.4
  - @voyantjs/bookings@0.66.4
  - @voyantjs/core@0.66.4
  - @voyantjs/db@0.66.4
  - @voyantjs/hono@0.66.4
  - @voyantjs/products@0.66.4
  - @voyantjs/storage@0.66.4
  - @voyantjs/utils@0.66.4

## 0.66.3

### Patch Changes

- @voyantjs/action-ledger@0.66.3
- @voyantjs/bookings@0.66.3
- @voyantjs/core@0.66.3
- @voyantjs/db@0.66.3
- @voyantjs/hono@0.66.3
- @voyantjs/products@0.66.3
- @voyantjs/storage@0.66.3
- @voyantjs/utils@0.66.3

## 0.66.2

### Patch Changes

- @voyantjs/action-ledger@0.66.2
- @voyantjs/bookings@0.66.2
- @voyantjs/core@0.66.2
- @voyantjs/db@0.66.2
- @voyantjs/hono@0.66.2
- @voyantjs/products@0.66.2
- @voyantjs/storage@0.66.2
- @voyantjs/utils@0.66.2

## 0.66.1

### Patch Changes

- @voyantjs/action-ledger@0.66.1
- @voyantjs/bookings@0.66.1
- @voyantjs/core@0.66.1
- @voyantjs/db@0.66.1
- @voyantjs/hono@0.66.1
- @voyantjs/products@0.66.1
- @voyantjs/storage@0.66.1
- @voyantjs/utils@0.66.1

## 0.66.0

### Patch Changes

- @voyantjs/action-ledger@0.66.0
- @voyantjs/bookings@0.66.0
- @voyantjs/core@0.66.0
- @voyantjs/db@0.66.0
- @voyantjs/hono@0.66.0
- @voyantjs/products@0.66.0
- @voyantjs/storage@0.66.0
- @voyantjs/utils@0.66.0

## 0.65.0

### Patch Changes

- @voyantjs/action-ledger@0.65.0
- @voyantjs/bookings@0.65.0
- @voyantjs/core@0.65.0
- @voyantjs/db@0.65.0
- @voyantjs/hono@0.65.0
- @voyantjs/products@0.65.0
- @voyantjs/storage@0.65.0
- @voyantjs/utils@0.65.0

## 0.64.1

### Patch Changes

- 572dde4: Add configurable customer-facing payment-link base URLs for generated links and notification template context.
  - @voyantjs/action-ledger@0.64.1
  - @voyantjs/bookings@0.64.1
  - @voyantjs/core@0.64.1
  - @voyantjs/db@0.64.1
  - @voyantjs/hono@0.64.1
  - @voyantjs/products@0.64.1
  - @voyantjs/storage@0.64.1
  - @voyantjs/utils@0.64.1

## 0.64.0

### Patch Changes

- 6d0c8f3: Extract `withOptionalTransaction` into `@voyantjs/db/transaction` so the soft-fallback helper that action-ledger has used since 0.62.0 can be shared by any package that needs it. Add `Module.requiresTransactionalDb` so modules whose write paths use interactive transactions declare it, and have `createApp()` assert on first request that the resolved db adapter supports `db.transaction(async (tx) => …)`. With the neon-http (edge) adapter that assertion now throws an actionable error pointing at `createServerlessDbClient` (neon-serverless / WebSocket) or `createDbClient(url, { adapter: "node" })` — instead of the cryptic "No transactions support in neon-http driver" exception thrown on first write.
- Updated dependencies [6d0c8f3]
  - @voyantjs/action-ledger@0.64.0
  - @voyantjs/bookings@0.64.0
  - @voyantjs/core@0.64.0
  - @voyantjs/db@0.64.0
  - @voyantjs/hono@0.64.0
  - @voyantjs/products@0.64.0
  - @voyantjs/storage@0.64.0
  - @voyantjs/utils@0.64.0

## 0.63.1

### Patch Changes

- @voyantjs/action-ledger@0.63.1
- @voyantjs/bookings@0.63.1
- @voyantjs/core@0.63.1
- @voyantjs/db@0.63.1
- @voyantjs/hono@0.63.1
- @voyantjs/products@0.63.1
- @voyantjs/storage@0.63.1
- @voyantjs/utils@0.63.1

## 0.63.0

### Patch Changes

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

- Updated dependencies [5bff9c3]
  - @voyantjs/action-ledger@0.63.0
  - @voyantjs/bookings@0.63.0
  - @voyantjs/core@0.63.0
  - @voyantjs/db@0.63.0
  - @voyantjs/hono@0.63.0
  - @voyantjs/products@0.63.0
  - @voyantjs/storage@0.63.0
  - @voyantjs/utils@0.63.0

## 0.62.3

### Patch Changes

- @voyantjs/action-ledger@0.62.3
- @voyantjs/bookings@0.62.3
- @voyantjs/core@0.62.3
- @voyantjs/db@0.62.3
- @voyantjs/hono@0.62.3
- @voyantjs/products@0.62.3
- @voyantjs/storage@0.62.3
- @voyantjs/utils@0.62.3

## 0.62.2

### Patch Changes

- Updated dependencies [4a87635]
  - @voyantjs/action-ledger@0.62.2
  - @voyantjs/bookings@0.62.2
  - @voyantjs/core@0.62.2
  - @voyantjs/db@0.62.2
  - @voyantjs/hono@0.62.2
  - @voyantjs/products@0.62.2
  - @voyantjs/storage@0.62.2
  - @voyantjs/utils@0.62.2

## 0.62.1

### Patch Changes

- Updated dependencies [ebbeab8]
  - @voyantjs/action-ledger@0.62.1
  - @voyantjs/bookings@0.62.1
  - @voyantjs/core@0.62.1
  - @voyantjs/db@0.62.1
  - @voyantjs/hono@0.62.1
  - @voyantjs/products@0.62.1
  - @voyantjs/storage@0.62.1
  - @voyantjs/utils@0.62.1

## 0.62.0

### Patch Changes

- Updated dependencies [77aad68]
  - @voyantjs/action-ledger@0.62.0
  - @voyantjs/bookings@0.62.0
  - @voyantjs/core@0.62.0
  - @voyantjs/db@0.62.0
  - @voyantjs/hono@0.62.0
  - @voyantjs/products@0.62.0
  - @voyantjs/storage@0.62.0
  - @voyantjs/utils@0.62.0

## 0.61.0

### Patch Changes

- Updated dependencies [89f033e]
  - @voyantjs/action-ledger@0.61.0
  - @voyantjs/bookings@0.61.0
  - @voyantjs/core@0.61.0
  - @voyantjs/db@0.61.0
  - @voyantjs/hono@0.61.0
  - @voyantjs/products@0.61.0
  - @voyantjs/storage@0.61.0
  - @voyantjs/utils@0.61.0

## 0.60.0

### Patch Changes

- Updated dependencies [4ff7f15]
  - @voyantjs/action-ledger@0.60.0
  - @voyantjs/bookings@0.60.0
  - @voyantjs/core@0.60.0
  - @voyantjs/db@0.60.0
  - @voyantjs/hono@0.60.0
  - @voyantjs/products@0.60.0
  - @voyantjs/storage@0.60.0
  - @voyantjs/utils@0.60.0

## 0.59.0

### Patch Changes

- Updated dependencies [48927be]
  - @voyantjs/action-ledger@0.59.0
  - @voyantjs/bookings@0.59.0
  - @voyantjs/core@0.59.0
  - @voyantjs/db@0.59.0
  - @voyantjs/hono@0.59.0
  - @voyantjs/products@0.59.0
  - @voyantjs/storage@0.59.0
  - @voyantjs/utils@0.59.0

## 0.58.0

### Patch Changes

- @voyantjs/action-ledger@0.58.0
- @voyantjs/bookings@0.58.0
- @voyantjs/core@0.58.0
- @voyantjs/db@0.58.0
- @voyantjs/hono@0.58.0
- @voyantjs/products@0.58.0
- @voyantjs/storage@0.58.0
- @voyantjs/utils@0.58.0

## 0.57.0

### Patch Changes

- @voyantjs/action-ledger@0.57.0
- @voyantjs/bookings@0.57.0
- @voyantjs/core@0.57.0
- @voyantjs/db@0.57.0
- @voyantjs/hono@0.57.0
- @voyantjs/products@0.57.0
- @voyantjs/storage@0.57.0
- @voyantjs/utils@0.57.0

## 0.56.0

### Patch Changes

- @voyantjs/action-ledger@0.56.0
- @voyantjs/bookings@0.56.0
- @voyantjs/core@0.56.0
- @voyantjs/db@0.56.0
- @voyantjs/hono@0.56.0
- @voyantjs/products@0.56.0
- @voyantjs/storage@0.56.0
- @voyantjs/utils@0.56.0

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
  - @voyantjs/action-ledger@0.55.1
  - @voyantjs/bookings@0.55.1
  - @voyantjs/core@0.55.1
  - @voyantjs/db@0.55.1
  - @voyantjs/hono@0.55.1
  - @voyantjs/products@0.55.1
  - @voyantjs/storage@0.55.1
  - @voyantjs/utils@0.55.1

## 0.55.0

### Patch Changes

- @voyantjs/action-ledger@0.55.0
- @voyantjs/bookings@0.55.0
- @voyantjs/core@0.55.0
- @voyantjs/db@0.55.0
- @voyantjs/hono@0.55.0
- @voyantjs/products@0.55.0
- @voyantjs/storage@0.55.0
- @voyantjs/utils@0.55.0

## 0.54.0

### Minor Changes

- 3117d27: Extract booking sell-side tax-preview helpers and route mounting into `@voyantjs/finance`.

### Patch Changes

- @voyantjs/action-ledger@0.54.0
- @voyantjs/bookings@0.54.0
- @voyantjs/core@0.54.0
- @voyantjs/db@0.54.0
- @voyantjs/hono@0.54.0
- @voyantjs/products@0.54.0
- @voyantjs/storage@0.54.0
- @voyantjs/utils@0.54.0

## 0.53.2

### Patch Changes

- @voyantjs/action-ledger@0.53.2
- @voyantjs/bookings@0.53.2
- @voyantjs/core@0.53.2
- @voyantjs/db@0.53.2
- @voyantjs/hono@0.53.2
- @voyantjs/storage@0.53.2
- @voyantjs/utils@0.53.2

## 0.53.1

### Patch Changes

- Updated dependencies [8ebac16]
  - @voyantjs/action-ledger@0.53.1
  - @voyantjs/bookings@0.53.1
  - @voyantjs/core@0.53.1
  - @voyantjs/db@0.53.1
  - @voyantjs/hono@0.53.1
  - @voyantjs/storage@0.53.1
  - @voyantjs/utils@0.53.1

## 0.53.0

### Patch Changes

- Updated dependencies [a315df6]
  - @voyantjs/action-ledger@0.53.0
  - @voyantjs/bookings@0.53.0
  - @voyantjs/core@0.53.0
  - @voyantjs/db@0.53.0
  - @voyantjs/hono@0.53.0
  - @voyantjs/storage@0.53.0
  - @voyantjs/utils@0.53.0

## 0.52.4

### Patch Changes

- Updated dependencies [5d3c119]
  - @voyantjs/action-ledger@0.52.4
  - @voyantjs/bookings@0.52.4
  - @voyantjs/core@0.52.4
  - @voyantjs/db@0.52.4
  - @voyantjs/hono@0.52.4
  - @voyantjs/storage@0.52.4
  - @voyantjs/utils@0.52.4

## 0.52.3

### Patch Changes

- 9679a57: Add the initial action ledger package with append-only ledger schemas, TypeID prefixes, canonical idempotency fingerprints, capability registry and guard helpers, query helpers, request-context ledger helpers, shared target timeline serialization, payload/relay append support, booking PII sensitive-read ledgering, booking traveler and travel-detail mutation ledgering, booking item/note/payment-policy mutation ledgering, booking action capability declarations and approval decision routing, booking action-ledger drift checks and dry-run remediation planning, finance invoice issuance/update/delete, invoice line-item ledgering, payment-session creation/update/lifecycle completion/failure/cancellation/expiration, payment instrument and authorization/capture ledgering, booking payment schedule and guarantee/default-plan ledgering, manual payment, supplier payment, and credit-note plus credit-note line-item ledgering, product create/update/delete ledgering with changed-field summaries and product timelines, nested product option, option-unit, translation, itinerary, day, day-service, media, brochure, feature, FAQ, location, taxonomy-link, destination-link, activation-setting, ticket-setting, visibility-setting, capability, and delivery-format mutation ledgering, product action-ledger drift checks, product admin route module splitting, admin list/detail routes with expanded filters and time windows plus payload and relay refs, relay outbox health listing with time windows and lifecycle helpers, runtime schema/route mounting, finance React client hooks for invoice and payment-session action ledger timelines, operator invoice/payment-session timeline mounting, product React client hooks and product detail activity UI, drift/canary health helpers and operator health endpoints, reversal recording support, route schema module split, client-safe React validation subpath imports, and reusable finance UI action ledger cards.
- Updated dependencies [9679a57]
  - @voyantjs/action-ledger@0.52.3
  - @voyantjs/bookings@0.52.3
  - @voyantjs/core@0.52.3
  - @voyantjs/db@0.52.3
  - @voyantjs/hono@0.52.3
  - @voyantjs/storage@0.52.3
  - @voyantjs/utils@0.52.3

## 0.52.2

### Patch Changes

- 3e09123: Finance: tax-on-issue + invoice flow refresh.

  - `finance/service-issue.ts` is the new home for the invoice-issue pipeline: it computes line-level tax at issue time, snapshots the resolved tax regime onto the invoice, and emits the events expected by the SmartBill plugin.
  - `service-booking-create.ts` and `service.ts` route through the issue service so converting a booking to an invoice picks up the same tax/regime logic as a direct issue.
  - New route added to expose the tax-preview surface consumed by `useBookingTaxPreview`.
  - `useInvoiceMutation` refreshes the booking invoices/pricing caches after issue/void/refund so detail pages no longer go stale.
  - `PaymentsPage` styling and empty-state polish; new i18n strings for the issue/preview flow (EN + RO via `i18n/admin/finance`).

- Updated dependencies [3e09123]
  - @voyantjs/bookings@0.52.2
  - @voyantjs/core@0.52.2
  - @voyantjs/db@0.52.2
  - @voyantjs/hono@0.52.2
  - @voyantjs/storage@0.52.2
  - @voyantjs/utils@0.52.2

## 0.52.1

### Patch Changes

- Updated dependencies [335d277]
  - @voyantjs/bookings@0.52.1
  - @voyantjs/core@0.52.1
  - @voyantjs/db@0.52.1
  - @voyantjs/hono@0.52.1
  - @voyantjs/storage@0.52.1
  - @voyantjs/utils@0.52.1

## 0.52.0

### Patch Changes

- @voyantjs/bookings@0.52.0
- @voyantjs/core@0.52.0
- @voyantjs/db@0.52.0
- @voyantjs/hono@0.52.0
- @voyantjs/storage@0.52.0
- @voyantjs/utils@0.52.0

## 0.51.1

### Patch Changes

- @voyantjs/bookings@0.51.1
- @voyantjs/core@0.51.1
- @voyantjs/db@0.51.1
- @voyantjs/hono@0.51.1
- @voyantjs/storage@0.51.1
- @voyantjs/utils@0.51.1

## 0.51.0

### Patch Changes

- @voyantjs/bookings@0.51.0
- @voyantjs/core@0.51.0
- @voyantjs/db@0.51.0
- @voyantjs/hono@0.51.0
- @voyantjs/storage@0.51.0
- @voyantjs/utils@0.51.0

## 0.50.8

### Patch Changes

- Updated dependencies [f35014f]
  - @voyantjs/bookings@0.50.8
  - @voyantjs/core@0.50.8
  - @voyantjs/db@0.50.8
  - @voyantjs/hono@0.50.8
  - @voyantjs/storage@0.50.8
  - @voyantjs/utils@0.50.8

## 0.50.7

### Patch Changes

- @voyantjs/bookings@0.50.7
- @voyantjs/core@0.50.7
- @voyantjs/db@0.50.7
- @voyantjs/hono@0.50.7
- @voyantjs/storage@0.50.7
- @voyantjs/utils@0.50.7

## 0.50.6

### Patch Changes

- c14f0a8: Fix the booking-create flow: scrollable dialog content with reachable actions, normalized product search, future departure lookup, shared-room clearing, explicit item lines, selectable traveler people including the payer, already-paid schedule rows, and booking-create naming throughout the API/registry surface.
- Updated dependencies [c14f0a8]
  - @voyantjs/bookings@0.50.6
  - @voyantjs/core@0.50.6
  - @voyantjs/db@0.50.6
  - @voyantjs/hono@0.50.6
  - @voyantjs/storage@0.50.6
  - @voyantjs/utils@0.50.6

## 0.50.5

### Patch Changes

- @voyantjs/bookings@0.50.5
- @voyantjs/core@0.50.5
- @voyantjs/db@0.50.5
- @voyantjs/hono@0.50.5
- @voyantjs/storage@0.50.5
- @voyantjs/utils@0.50.5

## 0.50.4

### Patch Changes

- @voyantjs/bookings@0.50.4
- @voyantjs/core@0.50.4
- @voyantjs/db@0.50.4
- @voyantjs/hono@0.50.4
- @voyantjs/storage@0.50.4
- @voyantjs/utils@0.50.4

## 0.50.3

### Patch Changes

- @voyantjs/bookings@0.50.3
- @voyantjs/core@0.50.3
- @voyantjs/db@0.50.3
- @voyantjs/hono@0.50.3
- @voyantjs/storage@0.50.3
- @voyantjs/utils@0.50.3

## 0.50.2

### Patch Changes

- @voyantjs/bookings@0.50.2
- @voyantjs/core@0.50.2
- @voyantjs/db@0.50.2
- @voyantjs/hono@0.50.2
- @voyantjs/storage@0.50.2
- @voyantjs/utils@0.50.2

## 0.50.1

### Patch Changes

- 7b768c5: Add storefront intake SDK helpers, expand storefront payment settings with split schedules and bank-transfer account metadata, and extend finance admin aggregates with dashboard counts, totals, and filters.
  - @voyantjs/bookings@0.50.1
  - @voyantjs/core@0.50.1
  - @voyantjs/db@0.50.1
  - @voyantjs/hono@0.50.1
  - @voyantjs/storage@0.50.1
  - @voyantjs/utils@0.50.1

## 0.50.0

### Patch Changes

- @voyantjs/bookings@0.50.0
- @voyantjs/core@0.50.0
- @voyantjs/db@0.50.0
- @voyantjs/hono@0.50.0
- @voyantjs/storage@0.50.0
- @voyantjs/utils@0.50.0

## 0.49.0

### Patch Changes

- @voyantjs/bookings@0.49.0
- @voyantjs/core@0.49.0
- @voyantjs/db@0.49.0
- @voyantjs/hono@0.49.0
- @voyantjs/storage@0.49.0
- @voyantjs/utils@0.49.0

## 0.48.0

### Patch Changes

- @voyantjs/bookings@0.48.0
- @voyantjs/core@0.48.0
- @voyantjs/db@0.48.0
- @voyantjs/hono@0.48.0
- @voyantjs/storage@0.48.0
- @voyantjs/utils@0.48.0

## 0.47.0

### Minor Changes

- 65408c6: Add stable legal document operation routes for contract template previews, stored document attachment, and PDF regeneration, plus booking-scoped customer-safe finance document lookup by reference.

### Patch Changes

- @voyantjs/bookings@0.47.0
- @voyantjs/core@0.47.0
- @voyantjs/db@0.47.0
- @voyantjs/hono@0.47.0
- @voyantjs/storage@0.47.0
- @voyantjs/utils@0.47.0

## 0.46.0

### Patch Changes

- @voyantjs/bookings@0.46.0
- @voyantjs/core@0.46.0
- @voyantjs/db@0.46.0
- @voyantjs/hono@0.46.0
- @voyantjs/storage@0.46.0
- @voyantjs/utils@0.46.0

## 0.45.0

### Patch Changes

- @voyantjs/bookings@0.45.0
- @voyantjs/core@0.45.0
- @voyantjs/db@0.45.0
- @voyantjs/hono@0.45.0
- @voyantjs/storage@0.45.0
- @voyantjs/utils@0.45.0

## 0.44.0

### Patch Changes

- @voyantjs/bookings@0.44.0
- @voyantjs/core@0.44.0
- @voyantjs/db@0.44.0
- @voyantjs/hono@0.44.0
- @voyantjs/storage@0.44.0
- @voyantjs/utils@0.44.0

## 0.43.0

### Patch Changes

- Updated dependencies [d07215e]
  - @voyantjs/bookings@0.43.0
  - @voyantjs/core@0.43.0
  - @voyantjs/db@0.43.0
  - @voyantjs/hono@0.43.0
  - @voyantjs/storage@0.43.0
  - @voyantjs/utils@0.43.0

## 0.42.0

### Minor Changes

- 786945f: Add `financeService.bindInvoiceRendition` for transactional ready-rendition binding and emit the metadata-only `invoice.rendered` event after successful invoice document rendition completion.

### Patch Changes

- @voyantjs/bookings@0.42.0
- @voyantjs/core@0.42.0
- @voyantjs/db@0.42.0
- @voyantjs/hono@0.42.0
- @voyantjs/storage@0.42.0
- @voyantjs/utils@0.42.0

## 0.41.3

### Patch Changes

- @voyantjs/bookings@0.41.3
- @voyantjs/core@0.41.3
- @voyantjs/db@0.41.3
- @voyantjs/hono@0.41.3
- @voyantjs/storage@0.41.3
- @voyantjs/utils@0.41.3

## 0.41.2

### Patch Changes

- @voyantjs/bookings@0.41.2
- @voyantjs/core@0.41.2
- @voyantjs/db@0.41.2
- @voyantjs/hono@0.41.2
- @voyantjs/storage@0.41.2
- @voyantjs/utils@0.41.2

## 0.41.1

### Patch Changes

- @voyantjs/bookings@0.41.1
- @voyantjs/core@0.41.1
- @voyantjs/db@0.41.1
- @voyantjs/hono@0.41.1
- @voyantjs/storage@0.41.1
- @voyantjs/utils@0.41.1

## 0.41.0

### Patch Changes

- @voyantjs/bookings@0.41.0
- @voyantjs/core@0.41.0
- @voyantjs/db@0.41.0
- @voyantjs/hono@0.41.0
- @voyantjs/storage@0.41.0
- @voyantjs/utils@0.41.0

## 0.40.1

### Patch Changes

- @voyantjs/bookings@0.40.1
- @voyantjs/core@0.40.1
- @voyantjs/db@0.40.1
- @voyantjs/hono@0.40.1
- @voyantjs/storage@0.40.1
- @voyantjs/utils@0.40.1

## 0.40.0

### Patch Changes

- @voyantjs/bookings@0.40.0
- @voyantjs/core@0.40.0
- @voyantjs/db@0.40.0
- @voyantjs/hono@0.40.0
- @voyantjs/storage@0.40.0
- @voyantjs/utils@0.40.0

## 0.39.0

### Patch Changes

- 2297949: Enrich `invoice.issued` and `invoice.proforma.issued` event payloads with booking contact fields, issue/due dates, and persisted invoice line items so billing adapter default mappers can build complete invoice bodies.
- Updated dependencies [f4235ea]
  - @voyantjs/bookings@0.39.0
  - @voyantjs/core@0.39.0
  - @voyantjs/db@0.39.0
  - @voyantjs/hono@0.39.0
  - @voyantjs/storage@0.39.0
  - @voyantjs/utils@0.39.0

## 0.38.2

### Patch Changes

- @voyantjs/bookings@0.38.2
- @voyantjs/core@0.38.2
- @voyantjs/db@0.38.2
- @voyantjs/hono@0.38.2
- @voyantjs/storage@0.38.2
- @voyantjs/utils@0.38.2

## 0.38.1

### Patch Changes

- @voyantjs/bookings@0.38.1
- @voyantjs/core@0.38.1
- @voyantjs/db@0.38.1
- @voyantjs/hono@0.38.1
- @voyantjs/storage@0.38.1
- @voyantjs/utils@0.38.1

## 0.38.0

### Patch Changes

- @voyantjs/bookings@0.38.0
- @voyantjs/core@0.38.0
- @voyantjs/db@0.38.0
- @voyantjs/hono@0.38.0
- @voyantjs/storage@0.38.0
- @voyantjs/utils@0.38.0

## 0.37.1

### Patch Changes

- @voyantjs/bookings@0.37.1
- @voyantjs/core@0.37.1
- @voyantjs/db@0.37.1
- @voyantjs/hono@0.37.1
- @voyantjs/storage@0.37.1
- @voyantjs/utils@0.37.1

## 0.37.0

### Minor Changes

- dc29b79: Persist operator-confirmed booking totals from the create dialog and audit manual price overrides with a required reason.

### Patch Changes

- f014fd2: Capture manual base-currency settlement amounts for cross-currency customer and supplier payments, and settle invoice balances from the base invoice amount.
- Updated dependencies [4c93561]
- Updated dependencies [dc29b79]
  - @voyantjs/bookings@0.37.0
  - @voyantjs/core@0.37.0
  - @voyantjs/db@0.37.0
  - @voyantjs/hono@0.37.0
  - @voyantjs/storage@0.37.0
  - @voyantjs/utils@0.37.0

## 0.36.0

### Patch Changes

- Updated dependencies [15e6953]
  - @voyantjs/bookings@0.36.0
  - @voyantjs/core@0.36.0
  - @voyantjs/db@0.36.0
  - @voyantjs/hono@0.36.0
  - @voyantjs/storage@0.36.0
  - @voyantjs/utils@0.36.0

## 0.35.0

### Patch Changes

- @voyantjs/bookings@0.35.0
- @voyantjs/core@0.35.0
- @voyantjs/db@0.35.0
- @voyantjs/hono@0.35.0
- @voyantjs/storage@0.35.0
- @voyantjs/utils@0.35.0

## 0.34.0

### Patch Changes

- 9095837: Emit a first-class booking payment schedule paid event when schedule-backed payment sessions complete, and include target metadata on generic payment completion events.
- Updated dependencies [a37d4af]
  - @voyantjs/bookings@0.34.0
  - @voyantjs/core@0.34.0
  - @voyantjs/db@0.34.0
  - @voyantjs/hono@0.34.0
  - @voyantjs/storage@0.34.0
  - @voyantjs/utils@0.34.0

## 0.33.1

### Patch Changes

- Updated dependencies [9bee9aa]
  - @voyantjs/bookings@0.33.1
  - @voyantjs/core@0.33.1
  - @voyantjs/db@0.33.1
  - @voyantjs/hono@0.33.1
  - @voyantjs/storage@0.33.1
  - @voyantjs/utils@0.33.1

## 0.33.0

### Patch Changes

- @voyantjs/bookings@0.33.0
- @voyantjs/core@0.33.0
- @voyantjs/db@0.33.0
- @voyantjs/hono@0.33.0
- @voyantjs/storage@0.33.0
- @voyantjs/utils@0.33.0

## 0.32.3

### Patch Changes

- @voyantjs/bookings@0.32.3
- @voyantjs/core@0.32.3
- @voyantjs/db@0.32.3
- @voyantjs/hono@0.32.3
- @voyantjs/storage@0.32.3
- @voyantjs/utils@0.32.3

## 0.32.2

### Patch Changes

- @voyantjs/bookings@0.32.2
- @voyantjs/core@0.32.2
- @voyantjs/db@0.32.2
- @voyantjs/hono@0.32.2
- @voyantjs/storage@0.32.2
- @voyantjs/utils@0.32.2

## 0.32.1

### Patch Changes

- @voyantjs/bookings@0.32.1
- @voyantjs/core@0.32.1
- @voyantjs/db@0.32.1
- @voyantjs/hono@0.32.1
- @voyantjs/storage@0.32.1
- @voyantjs/utils@0.32.1

## 0.32.0

### Minor Changes

- 6ea6ded: Harden public checkout sessions with scoped signed capabilities. Public booking-session creation now returns a short-lived checkout capability and sets an HttpOnly SameSite cookie; PII-bearing session reads, session mutations, repricing/finalization, and public finance payment bootstrap/read routes require that booking-scoped capability. Public mutable checkout/payment routes also accept the shared `Idempotency-Key` retry middleware where it was missing.

### Patch Changes

- Updated dependencies [6ea6ded]
  - @voyantjs/bookings@0.32.0
  - @voyantjs/core@0.32.0
  - @voyantjs/db@0.32.0
  - @voyantjs/hono@0.32.0
  - @voyantjs/storage@0.32.0
  - @voyantjs/utils@0.32.0

## 0.31.4

### Patch Changes

- @voyantjs/bookings@0.31.4
- @voyantjs/core@0.31.4
- @voyantjs/db@0.31.4
- @voyantjs/hono@0.31.4
- @voyantjs/storage@0.31.4
- @voyantjs/utils@0.31.4

## 0.31.3

### Patch Changes

- 5f974dd: Add first-class invoice attachment persistence, admin routes, React hooks, and invoice detail UI.
- Updated dependencies [5f974dd]
  - @voyantjs/bookings@0.31.3
  - @voyantjs/core@0.31.3
  - @voyantjs/db@0.31.3
  - @voyantjs/hono@0.31.3
  - @voyantjs/storage@0.31.3
  - @voyantjs/utils@0.31.3

## 0.31.2

### Patch Changes

- Updated dependencies [54ddc93]
  - @voyantjs/bookings@0.31.2
  - @voyantjs/core@0.31.2
  - @voyantjs/db@0.31.2
  - @voyantjs/hono@0.31.2
  - @voyantjs/storage@0.31.2
  - @voyantjs/utils@0.31.2

## 0.31.1

### Patch Changes

- @voyantjs/bookings@0.31.1
- @voyantjs/core@0.31.1
- @voyantjs/db@0.31.1
- @voyantjs/hono@0.31.1
- @voyantjs/storage@0.31.1
- @voyantjs/utils@0.31.1

## 0.31.0

### Patch Changes

- @voyantjs/bookings@0.31.0
- @voyantjs/core@0.31.0
- @voyantjs/db@0.31.0
- @voyantjs/hono@0.31.0
- @voyantjs/storage@0.31.0
- @voyantjs/utils@0.31.0

## 0.30.7

### Patch Changes

- @voyantjs/bookings@0.30.7
- @voyantjs/core@0.30.7
- @voyantjs/db@0.30.7
- @voyantjs/hono@0.30.7
- @voyantjs/storage@0.30.7
- @voyantjs/utils@0.30.7

## 0.30.6

### Patch Changes

- Updated dependencies [5a4c592]
  - @voyantjs/bookings@0.30.6
  - @voyantjs/core@0.30.6
  - @voyantjs/db@0.30.6
  - @voyantjs/hono@0.30.6
  - @voyantjs/storage@0.30.6
  - @voyantjs/utils@0.30.6

## 0.30.5

### Patch Changes

- Updated dependencies [3f323e9]
  - @voyantjs/bookings@0.30.5
  - @voyantjs/core@0.30.5
  - @voyantjs/db@0.30.5
  - @voyantjs/hono@0.30.5
  - @voyantjs/storage@0.30.5
  - @voyantjs/utils@0.30.5

## 0.30.4

### Patch Changes

- @voyantjs/bookings@0.30.4
- @voyantjs/core@0.30.4
- @voyantjs/db@0.30.4
- @voyantjs/hono@0.30.4
- @voyantjs/storage@0.30.4
- @voyantjs/utils@0.30.4

## 0.30.3

### Patch Changes

- Updated dependencies [05a1b19]
  - @voyantjs/bookings@0.30.3
  - @voyantjs/core@0.30.3
  - @voyantjs/db@0.30.3
  - @voyantjs/hono@0.30.3
  - @voyantjs/storage@0.30.3
  - @voyantjs/utils@0.30.3

## 0.30.2

### Patch Changes

- @voyantjs/bookings@0.30.2
- @voyantjs/core@0.30.2
- @voyantjs/db@0.30.2
- @voyantjs/hono@0.30.2
- @voyantjs/storage@0.30.2
- @voyantjs/utils@0.30.2

## 0.30.1

### Patch Changes

- @voyantjs/bookings@0.30.1
- @voyantjs/core@0.30.1
- @voyantjs/db@0.30.1
- @voyantjs/hono@0.30.1
- @voyantjs/storage@0.30.1
- @voyantjs/utils@0.30.1

## 0.30.0

### Patch Changes

- @voyantjs/bookings@0.30.0
- @voyantjs/core@0.30.0
- @voyantjs/db@0.30.0
- @voyantjs/hono@0.30.0
- @voyantjs/storage@0.30.0
- @voyantjs/utils@0.30.0

## 0.29.0

### Patch Changes

- Updated dependencies [3420711]
- Updated dependencies [583326e]
- Updated dependencies [583326e]
- Updated dependencies [4a6523e]
- Updated dependencies [db51715]
  - @voyantjs/bookings@0.29.0
  - @voyantjs/core@0.29.0
  - @voyantjs/db@0.29.0
  - @voyantjs/hono@0.29.0
  - @voyantjs/storage@0.29.0
  - @voyantjs/utils@0.29.0

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
  - @voyantjs/bookings@0.28.3
  - @voyantjs/core@0.28.3
  - @voyantjs/db@0.28.3
  - @voyantjs/hono@0.28.3
  - @voyantjs/storage@0.28.3
  - @voyantjs/utils@0.28.3

## 0.28.2

### Patch Changes

- @voyantjs/bookings@0.28.2
- @voyantjs/core@0.28.2
- @voyantjs/db@0.28.2
- @voyantjs/hono@0.28.2
- @voyantjs/storage@0.28.2
- @voyantjs/utils@0.28.2

## 0.28.1

### Patch Changes

- @voyantjs/bookings@0.28.1
- @voyantjs/core@0.28.1
- @voyantjs/db@0.28.1
- @voyantjs/hono@0.28.1
- @voyantjs/storage@0.28.1
- @voyantjs/utils@0.28.1

## 0.28.0

### Patch Changes

- @voyantjs/bookings@0.28.0
- @voyantjs/core@0.28.0
- @voyantjs/db@0.28.0
- @voyantjs/hono@0.28.0
- @voyantjs/storage@0.28.0
- @voyantjs/utils@0.28.0

## 0.27.0

### Patch Changes

- @voyantjs/bookings@0.27.0
- @voyantjs/core@0.27.0
- @voyantjs/db@0.27.0
- @voyantjs/hono@0.27.0
- @voyantjs/storage@0.27.0
- @voyantjs/utils@0.27.0

## 0.26.9

### Patch Changes

- @voyantjs/bookings@0.26.9
- @voyantjs/core@0.26.9
- @voyantjs/db@0.26.9
- @voyantjs/hono@0.26.9
- @voyantjs/storage@0.26.9
- @voyantjs/utils@0.26.9

## 0.26.8

### Patch Changes

- @voyantjs/bookings@0.26.8
- @voyantjs/core@0.26.8
- @voyantjs/db@0.26.8
- @voyantjs/hono@0.26.8
- @voyantjs/storage@0.26.8
- @voyantjs/utils@0.26.8

## 0.26.7

### Patch Changes

- @voyantjs/bookings@0.26.7
- @voyantjs/core@0.26.7
- @voyantjs/db@0.26.7
- @voyantjs/hono@0.26.7
- @voyantjs/storage@0.26.7
- @voyantjs/utils@0.26.7

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
