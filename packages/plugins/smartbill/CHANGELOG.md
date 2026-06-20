# @voyant-travel/plugin-smartbill

## 0.127.0

### Patch Changes

- @voyant-travel/finance@0.127.0
- @voyant-travel/finance-react@0.127.0

## 0.126.0

### Patch Changes

- @voyant-travel/finance-react@0.126.0
- @voyant-travel/finance@0.126.0

## 0.125.1

### Patch Changes

- ea96ad9: Strip deprecated `measureUnit` product fields from SmartBill outbound payloads so proforma creation is accepted by the strict estimate endpoint.

## 0.125.0

### Patch Changes

- Updated dependencies [a74471e]
  - @voyant-travel/ui@0.108.0
  - @voyant-travel/finance-react@0.125.0
  - @voyant-travel/finance@0.125.0
  - @voyant-travel/hono@0.112.2

## 0.124.0

### Patch Changes

- Updated dependencies [4f92198]
- Updated dependencies [4f92198]
  - @voyant-travel/finance-react@0.124.0
  - @voyant-travel/ui@0.107.0
  - @voyant-travel/hono@0.112.1
  - @voyant-travel/finance@0.124.0

## 0.123.0

### Patch Changes

- Updated dependencies [98f4a40]
- Updated dependencies [a3bd51c]
- Updated dependencies [e9d9dbb]
- Updated dependencies [3b27dcc]
- Updated dependencies [39d48fe]
- Updated dependencies [d222e9f]
  - @voyant-travel/core@0.110.0
  - @voyant-travel/hono@0.112.0
  - @voyant-travel/finance@0.123.0
  - @voyant-travel/finance-react@0.123.0

## 0.122.0

### Patch Changes

- Updated dependencies [c9de9c4]
- Updated dependencies [14f4234]
- Updated dependencies [89d4ca9]
- Updated dependencies [51dd276]
  - @voyant-travel/finance@0.122.0
  - @voyant-travel/finance-react@0.122.0

## 0.121.0

### Patch Changes

- Updated dependencies [13fe70b]
- Updated dependencies [9ea7220]
- Updated dependencies [13fe70b]
  - @voyant-travel/finance@0.121.0
  - @voyant-travel/hono@0.111.0
  - @voyant-travel/storage@0.105.0
  - @voyant-travel/finance-react@0.121.0

## 0.120.1

### Patch Changes

- eef1a00: Republish notification and UI consumer packages so stale beta artifacts no longer reference legacy notification package specifiers.
- Updated dependencies [eef1a00]
  - @voyant-travel/finance-react@0.120.1
  - @voyant-travel/finance@0.120.1

## 0.120.0

### Patch Changes

- Updated dependencies [6bff46f]
- Updated dependencies [0fa993c]
- Updated dependencies [9e970a5]
- Updated dependencies [b711b04]
- Updated dependencies [3408b2a]
- Updated dependencies [47fef18]
- Updated dependencies [6196b3b]
  - @voyant-travel/hono@0.110.0
  - @voyant-travel/finance@0.120.0
  - @voyant-travel/finance-react@0.120.0

## 0.119.2

### Patch Changes

- bed090c: Split oversized SmartBill plugin client, mock, sync, workflow, and unit test modules into focused internal files while preserving the existing public subpath exports and behavior.
- Updated dependencies [0b10029]
  - @voyant-travel/utils@0.105.1

## 0.119.1

### Patch Changes

- a224ef6: Refine plugin HTTP fetch adapters to avoid unsafe implementation casts.

## 0.119.0

### Patch Changes

- b0f1e21: SmartBill client calls now go through `resilientFetch` (RFC #1687 Phase 3.3): 10s per-attempt timeout, capped jittered retries (3 attempts on network errors/timeouts/429/5xx) for idempotent operations only — GETs, PDF downloads, cancel/restore/delete — and a per-client circuit breaker that fails fast with `CircuitOpenError` after repeated upstream failures. Document-creating calls (`createInvoice`, `createProforma`, `convertEstimateToInvoice`, `reverseInvoice`) never retry because SmartBill has no idempotency keys — a duplicate invoice is worse than a failed sync the outbox redelivers. Behavior change: calls against a hung upstream now fail after ~10s per attempt instead of hanging for the platform ceiling. The final failing response is still surfaced to `SmartbillApiError` mapping (status + body preserved), and the SmartBill-specific 403 rate-limit circuit is unchanged. Tune via the new `resilience` client/plugin option (`timeoutMs`, `retry`, `breaker`).
- Updated dependencies [b0f1e21]
- Updated dependencies [b0f1e21]
  - @voyant-travel/hono@0.109.0
  - @voyant-travel/utils@0.105.0
  - @voyant-travel/finance@0.119.0
  - @voyant-travel/ui@0.106.1
  - @voyant-travel/finance-react@0.119.0

## 0.118.0

### Patch Changes

- @voyant-travel/finance@0.118.0
- @voyant-travel/finance-react@0.118.0

## 0.117.1

### Patch Changes

- Updated dependencies [b7056f1]
- Updated dependencies [b7056f1]
- Updated dependencies [b7056f1]
  - @voyant-travel/finance@0.117.1
  - @voyant-travel/core@0.109.0
  - @voyant-travel/hono@0.108.0
  - @voyant-travel/finance-react@0.117.1

## 0.117.0

### Patch Changes

- Updated dependencies [7255353]
- Updated dependencies [7255353]
- Updated dependencies [7255353]
- Updated dependencies [7255353]
  - @voyant-travel/core@0.108.0
  - @voyant-travel/hono@0.107.0
  - @voyant-travel/finance@0.117.0
  - @voyant-travel/finance-react@0.117.0

## 0.116.0

### Patch Changes

- Updated dependencies [418fa82]
- Updated dependencies [418fa82]
  - @voyant-travel/core@0.107.0
  - @voyant-travel/hono@0.106.0
  - @voyant-travel/finance@0.116.0
  - @voyant-travel/finance-react@0.116.0

## 0.115.0

### Patch Changes

- Updated dependencies [41b08db]
  - @voyant-travel/finance-react@0.115.0
  - @voyant-travel/finance@0.115.0

## 0.114.0

### Patch Changes

- Updated dependencies [f7bd971]
  - @voyant-travel/finance-react@0.114.0
  - @voyant-travel/finance@0.114.0

## 0.113.0

### Patch Changes

- @voyant-travel/finance-react@0.113.0
- @voyant-travel/finance@0.113.0

## 0.112.0

### Patch Changes

- Updated dependencies [279f97c]
- Updated dependencies [faec538]
  - @voyant-travel/finance-react@0.112.0
  - @voyant-travel/finance@0.112.0

## 0.111.0

### Patch Changes

- Updated dependencies [478aa7c]
  - @voyant-travel/finance-react@0.111.0
  - @voyant-travel/finance@0.111.0

## 0.110.0

### Patch Changes

- Updated dependencies [6c27159]
- Updated dependencies [eeb23df]
  - @voyant-travel/finance-react@0.110.0
  - @voyant-travel/core@0.106.0
  - @voyant-travel/finance@0.110.0
  - @voyant-travel/hono@0.105.3

## 0.109.0

### Patch Changes

- Updated dependencies [8638834]
- Updated dependencies [3bd66e9]
- Updated dependencies [344e7b6]
  - @voyant-travel/finance-react@0.109.0
  - @voyant-travel/ui@0.106.0
  - @voyant-travel/core@0.105.1
  - @voyant-travel/finance@0.109.0
  - @voyant-travel/hono@0.105.2

## 0.108.0

### Patch Changes

- @voyant-travel/finance@0.108.0
- @voyant-travel/ui@0.105.1
- @voyant-travel/finance-react@0.108.0

## 0.107.1

### Patch Changes

- Updated dependencies [656b25d]
  - @voyant-travel/hono@0.105.0
  - @voyant-travel/finance@0.107.1
  - @voyant-travel/finance-react@0.107.1

## 0.107.0

### Patch Changes

- Updated dependencies [c2aef18]
- Updated dependencies [d1ad572]
  - @voyant-travel/core@0.105.0
  - @voyant-travel/ui@0.105.0
  - @voyant-travel/finance@0.107.0
  - @voyant-travel/hono@0.104.2
  - @voyant-travel/finance-react@0.107.0

## 0.106.3

### Patch Changes

- ed8ac1c: Add request spacing and rate-limit early stop behavior to SmartBill workflow factories.

## 0.106.2

### Patch Changes

- Add opt-in SmartBill series discovery to the drift reconciler so `missing_local` findings can be reported without caller-supplied remote inventory.
- Add invoice-candidate sources to SmartBill workflow factories so deployments can reconcile or poll invoices before external refs are materialized.

## 0.106.1

### Patch Changes

- 9c22b6b: Cancel SmartBill invoices when Voyant invoices are voided and persist the external reference cancellation state.
- Updated dependencies [9c22b6b]
  - @voyant-travel/finance@0.106.7
  - @voyant-travel/finance-react@0.106.7

## 0.106.0

### Patch Changes

- @voyant-travel/finance@0.106.0
- @voyant-travel/finance-react@0.106.0

## 0.105.0

### Patch Changes

- @voyant-travel/finance@0.105.0
- @voyant-travel/finance-react@0.105.0

## 0.104.1

### Patch Changes

- @voyant-travel/core@0.104.1
- @voyant-travel/finance@0.104.1
- @voyant-travel/finance-react@0.104.1
- @voyant-travel/hono@0.104.1
- @voyant-travel/storage@0.104.1
- @voyant-travel/ui@0.104.1

## 0.104.0

### Patch Changes

- @voyant-travel/core@0.104.0
- @voyant-travel/finance@0.104.0
- @voyant-travel/finance-react@0.104.0
- @voyant-travel/hono@0.104.0
- @voyant-travel/storage@0.104.0
- @voyant-travel/ui@0.104.0

## 0.103.0

### Patch Changes

- @voyant-travel/core@0.103.0
- @voyant-travel/finance@0.103.0
- @voyant-travel/finance-react@0.103.0
- @voyant-travel/hono@0.103.0
- @voyant-travel/storage@0.103.0
- @voyant-travel/ui@0.103.0

## 0.102.0

### Patch Changes

- @voyant-travel/core@0.102.0
- @voyant-travel/finance@0.102.0
- @voyant-travel/finance-react@0.102.0
- @voyant-travel/hono@0.102.0
- @voyant-travel/storage@0.102.0
- @voyant-travel/ui@0.102.0

## 0.101.2

### Patch Changes

- Updated dependencies [577eaf5]
- Updated dependencies [577eaf5]
  - @voyant-travel/core@0.101.2
  - @voyant-travel/finance@0.101.2
  - @voyant-travel/finance-react@0.101.2
  - @voyant-travel/hono@0.101.2
  - @voyant-travel/storage@0.101.2
  - @voyant-travel/ui@0.101.2

## 0.101.1

### Patch Changes

- @voyant-travel/core@0.101.1
- @voyant-travel/finance@0.101.1
- @voyant-travel/finance-react@0.101.1
- @voyant-travel/hono@0.101.1
- @voyant-travel/storage@0.101.1
- @voyant-travel/ui@0.101.1

## 0.101.0

### Patch Changes

- @voyant-travel/core@0.101.0
- @voyant-travel/finance@0.101.0
- @voyant-travel/finance-react@0.101.0
- @voyant-travel/hono@0.101.0
- @voyant-travel/storage@0.101.0
- @voyant-travel/ui@0.101.0

## 0.100.0

### Patch Changes

- @voyant-travel/core@0.100.0
- @voyant-travel/finance@0.100.0
- @voyant-travel/finance-react@0.100.0
- @voyant-travel/hono@0.100.0
- @voyant-travel/storage@0.100.0
- @voyant-travel/ui@0.100.0

## 0.99.0

### Patch Changes

- Updated dependencies [b7dde79]
  - @voyant-travel/core@0.99.0
  - @voyant-travel/finance@0.99.0
  - @voyant-travel/finance-react@0.99.0
  - @voyant-travel/hono@0.99.0
  - @voyant-travel/storage@0.99.0
  - @voyant-travel/ui@0.99.0

## 0.98.0

### Patch Changes

- @voyant-travel/core@0.98.0
- @voyant-travel/finance@0.98.0
- @voyant-travel/finance-react@0.98.0
- @voyant-travel/hono@0.98.0
- @voyant-travel/storage@0.98.0
- @voyant-travel/ui@0.98.0

## 0.97.0

### Patch Changes

- @voyant-travel/core@0.97.0
- @voyant-travel/finance@0.97.0
- @voyant-travel/finance-react@0.97.0
- @voyant-travel/hono@0.97.0
- @voyant-travel/storage@0.97.0
- @voyant-travel/ui@0.97.0

## 0.96.0

### Patch Changes

- @voyant-travel/core@0.96.0
- @voyant-travel/finance@0.96.0
- @voyant-travel/finance-react@0.96.0
- @voyant-travel/hono@0.96.0
- @voyant-travel/storage@0.96.0
- @voyant-travel/ui@0.96.0

## 0.95.0

### Patch Changes

- @voyant-travel/core@0.95.0
- @voyant-travel/finance@0.95.0
- @voyant-travel/finance-react@0.95.0
- @voyant-travel/hono@0.95.0
- @voyant-travel/storage@0.95.0
- @voyant-travel/ui@0.95.0

## 0.94.0

### Patch Changes

- @voyant-travel/core@0.94.0
- @voyant-travel/finance@0.94.0
- @voyant-travel/finance-react@0.94.0
- @voyant-travel/hono@0.94.0
- @voyant-travel/storage@0.94.0
- @voyant-travel/ui@0.94.0

## 0.93.0

### Patch Changes

- @voyant-travel/core@0.93.0
- @voyant-travel/finance@0.93.0
- @voyant-travel/finance-react@0.93.0
- @voyant-travel/hono@0.93.0
- @voyant-travel/storage@0.93.0
- @voyant-travel/ui@0.93.0

## 0.92.0

### Patch Changes

- @voyant-travel/core@0.92.0
- @voyant-travel/finance@0.92.0
- @voyant-travel/finance-react@0.92.0
- @voyant-travel/hono@0.92.0
- @voyant-travel/storage@0.92.0
- @voyant-travel/ui@0.92.0

## 0.91.0

### Patch Changes

- @voyant-travel/core@0.91.0
- @voyant-travel/finance@0.91.0
- @voyant-travel/finance-react@0.91.0
- @voyant-travel/hono@0.91.0
- @voyant-travel/storage@0.91.0
- @voyant-travel/ui@0.91.0

## 0.90.0

### Patch Changes

- @voyant-travel/core@0.90.0
- @voyant-travel/finance@0.90.0
- @voyant-travel/finance-react@0.90.0
- @voyant-travel/hono@0.90.0
- @voyant-travel/storage@0.90.0
- @voyant-travel/ui@0.90.0

## 0.89.0

### Patch Changes

- @voyant-travel/core@0.89.0
- @voyant-travel/finance@0.89.0
- @voyant-travel/finance-react@0.89.0
- @voyant-travel/hono@0.89.0
- @voyant-travel/storage@0.89.0
- @voyant-travel/ui@0.89.0

## 0.88.0

### Patch Changes

- @voyant-travel/core@0.88.0
- @voyant-travel/finance@0.88.0
- @voyant-travel/finance-react@0.88.0
- @voyant-travel/hono@0.88.0
- @voyant-travel/storage@0.88.0
- @voyant-travel/ui@0.88.0

## 0.87.1

### Patch Changes

- Updated dependencies [5be088f]
  - @voyant-travel/core@0.87.1
  - @voyant-travel/finance@0.87.1
  - @voyant-travel/finance-react@0.87.1
  - @voyant-travel/hono@0.87.1
  - @voyant-travel/storage@0.87.1
  - @voyant-travel/ui@0.87.1

## 0.87.0

### Patch Changes

- @voyant-travel/core@0.87.0
- @voyant-travel/finance@0.87.0
- @voyant-travel/finance-react@0.87.0
- @voyant-travel/hono@0.87.0
- @voyant-travel/storage@0.87.0
- @voyant-travel/ui@0.87.0

## 0.86.0

### Patch Changes

- @voyant-travel/core@0.86.0
- @voyant-travel/finance@0.86.0
- @voyant-travel/finance-react@0.86.0
- @voyant-travel/hono@0.86.0
- @voyant-travel/storage@0.86.0
- @voyant-travel/ui@0.86.0

## 0.85.4

### Patch Changes

- Updated dependencies [bed4a3f]
  - @voyant-travel/core@0.85.4
  - @voyant-travel/finance@0.85.4
  - @voyant-travel/finance-react@0.85.4
  - @voyant-travel/hono@0.85.4
  - @voyant-travel/storage@0.85.4
  - @voyant-travel/ui@0.85.4

## 0.85.3

### Patch Changes

- @voyant-travel/core@0.85.3
- @voyant-travel/finance@0.85.3
- @voyant-travel/finance-react@0.85.3
- @voyant-travel/hono@0.85.3
- @voyant-travel/storage@0.85.3
- @voyant-travel/ui@0.85.3

## 0.85.2

### Patch Changes

- @voyant-travel/core@0.85.2
- @voyant-travel/finance@0.85.2
- @voyant-travel/finance-react@0.85.2
- @voyant-travel/hono@0.85.2
- @voyant-travel/storage@0.85.2
- @voyant-travel/ui@0.85.2

## 0.85.1

### Patch Changes

- @voyant-travel/core@0.85.1
- @voyant-travel/finance@0.85.1
- @voyant-travel/finance-react@0.85.1
- @voyant-travel/hono@0.85.1
- @voyant-travel/storage@0.85.1
- @voyant-travel/ui@0.85.1

## 0.85.0

### Patch Changes

- @voyant-travel/core@0.85.0
- @voyant-travel/finance@0.85.0
- @voyant-travel/finance-react@0.85.0
- @voyant-travel/hono@0.85.0
- @voyant-travel/storage@0.85.0
- @voyant-travel/ui@0.85.0

## 0.84.4

### Patch Changes

- Updated dependencies [f3f8de1]
  - @voyant-travel/core@0.84.4
  - @voyant-travel/finance@0.84.4
  - @voyant-travel/finance-react@0.84.4
  - @voyant-travel/hono@0.84.4
  - @voyant-travel/storage@0.84.4
  - @voyant-travel/ui@0.84.4

## 0.84.3

### Patch Changes

- 9eadf50: Release booking billing party snapshots so existing bookings can store individual or company billing details, including VAT/tax ID, and the billing dialog can prefill from CRM people or organizations.
  - @voyant-travel/core@0.84.3
  - @voyant-travel/finance@0.84.3
  - @voyant-travel/finance-react@0.84.3
  - @voyant-travel/hono@0.84.3
  - @voyant-travel/storage@0.84.3
  - @voyant-travel/ui@0.84.3

## 0.84.2

### Patch Changes

- @voyant-travel/core@0.84.2
- @voyant-travel/finance@0.84.2
- @voyant-travel/finance-react@0.84.2
- @voyant-travel/hono@0.84.2
- @voyant-travel/storage@0.84.2
- @voyant-travel/ui@0.84.2

## 0.84.1

### Patch Changes

- @voyant-travel/core@0.84.1
- @voyant-travel/finance@0.84.1
- @voyant-travel/finance-react@0.84.1
- @voyant-travel/hono@0.84.1
- @voyant-travel/storage@0.84.1
- @voyant-travel/ui@0.84.1

## 0.84.0

### Patch Changes

- Updated dependencies [4ea42b3]
  - @voyant-travel/core@0.84.0
  - @voyant-travel/finance@0.84.0
  - @voyant-travel/finance-react@0.84.0
  - @voyant-travel/hono@0.84.0
  - @voyant-travel/storage@0.84.0
  - @voyant-travel/ui@0.84.0

## 0.83.1

### Patch Changes

- @voyant-travel/core@0.83.1
- @voyant-travel/finance@0.83.1
- @voyant-travel/finance-react@0.83.1
- @voyant-travel/hono@0.83.1
- @voyant-travel/storage@0.83.1
- @voyant-travel/ui@0.83.1

## 0.83.0

### Patch Changes

- @voyant-travel/core@0.83.0
- @voyant-travel/finance@0.83.0
- @voyant-travel/finance-react@0.83.0
- @voyant-travel/hono@0.83.0
- @voyant-travel/storage@0.83.0
- @voyant-travel/ui@0.83.0

## 0.82.1

### Patch Changes

- @voyant-travel/core@0.82.1
- @voyant-travel/finance@0.82.1
- @voyant-travel/finance-react@0.82.1
- @voyant-travel/hono@0.82.1
- @voyant-travel/storage@0.82.1
- @voyant-travel/ui@0.82.1

## 0.82.0

### Patch Changes

- Updated dependencies [79ce168]
  - @voyant-travel/core@0.82.0
  - @voyant-travel/finance@0.82.0
  - @voyant-travel/finance-react@0.82.0
  - @voyant-travel/hono@0.82.0
  - @voyant-travel/storage@0.82.0
  - @voyant-travel/ui@0.82.0

## 0.81.21

### Patch Changes

- @voyant-travel/core@0.81.21
- @voyant-travel/finance@0.81.21
- @voyant-travel/finance-react@0.81.21
- @voyant-travel/hono@0.81.21
- @voyant-travel/storage@0.81.21
- @voyant-travel/ui@0.81.21

## 0.81.20

### Patch Changes

- @voyant-travel/core@0.81.20
- @voyant-travel/finance@0.81.20
- @voyant-travel/finance-react@0.81.20
- @voyant-travel/hono@0.81.20
- @voyant-travel/storage@0.81.20
- @voyant-travel/ui@0.81.20

## 0.81.19

### Patch Changes

- @voyant-travel/core@0.81.19
- @voyant-travel/finance@0.81.19
- @voyant-travel/finance-react@0.81.19
- @voyant-travel/hono@0.81.19
- @voyant-travel/storage@0.81.19
- @voyant-travel/ui@0.81.19

## 0.81.18

### Patch Changes

- @voyant-travel/core@0.81.18
- @voyant-travel/finance@0.81.18
- @voyant-travel/finance-react@0.81.18
- @voyant-travel/hono@0.81.18
- @voyant-travel/storage@0.81.18
- @voyant-travel/ui@0.81.18

## 0.81.17

### Patch Changes

- @voyant-travel/core@0.81.17
- @voyant-travel/finance@0.81.17
- @voyant-travel/finance-react@0.81.17
- @voyant-travel/hono@0.81.17
- @voyant-travel/storage@0.81.17
- @voyant-travel/ui@0.81.17

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
  - New shared primitives in `@voyant-travel/bookings-ui`: `IconActionButton` (icon button with built-in tooltip) and `StatusBadge` (semantic tone mapping for status strings) — exported from the package root.

- Updated dependencies [0a617cc]
  - @voyant-travel/core@0.81.16
  - @voyant-travel/finance@0.81.16
  - @voyant-travel/finance-react@0.81.16
  - @voyant-travel/hono@0.81.16
  - @voyant-travel/storage@0.81.16
  - @voyant-travel/ui@0.81.16

## 0.81.15

### Patch Changes

- Updated dependencies [b6bc138]
  - @voyant-travel/core@0.81.15
  - @voyant-travel/finance@0.81.15
  - @voyant-travel/finance-react@0.81.15
  - @voyant-travel/hono@0.81.15
  - @voyant-travel/storage@0.81.15
  - @voyant-travel/ui@0.81.15

## 0.81.14

### Patch Changes

- Updated dependencies [0a77ff9]
  - @voyant-travel/core@0.81.14
  - @voyant-travel/finance@0.81.14
  - @voyant-travel/finance-react@0.81.14
  - @voyant-travel/hono@0.81.14
  - @voyant-travel/storage@0.81.14
  - @voyant-travel/ui@0.81.14

## 0.81.13

### Patch Changes

- @voyant-travel/core@0.81.13
- @voyant-travel/finance@0.81.13
- @voyant-travel/finance-react@0.81.13
- @voyant-travel/hono@0.81.13
- @voyant-travel/storage@0.81.13
- @voyant-travel/ui@0.81.13

## 0.81.12

### Patch Changes

- @voyant-travel/core@0.81.12
- @voyant-travel/finance@0.81.12
- @voyant-travel/finance-react@0.81.12
- @voyant-travel/hono@0.81.12
- @voyant-travel/storage@0.81.12
- @voyant-travel/ui@0.81.12

## 0.81.11

### Patch Changes

- ef079f4: Allow voided invoices to release external invoice numbers for reissue and surface external allocation writeback conflicts on SmartBill refs.
- Updated dependencies [ef079f4]
  - @voyant-travel/core@0.81.11
  - @voyant-travel/finance@0.81.11
  - @voyant-travel/finance-react@0.81.11
  - @voyant-travel/hono@0.81.11
  - @voyant-travel/storage@0.81.11
  - @voyant-travel/ui@0.81.11

## 0.81.10

### Patch Changes

- Updated dependencies [6c6a008]
  - @voyant-travel/core@0.81.10
  - @voyant-travel/finance@0.81.10
  - @voyant-travel/finance-react@0.81.10
  - @voyant-travel/hono@0.81.10
  - @voyant-travel/storage@0.81.10
  - @voyant-travel/ui@0.81.10

## 0.81.9

### Patch Changes

- Updated dependencies [1a58939]
  - @voyant-travel/core@0.81.9
  - @voyant-travel/finance@0.81.9
  - @voyant-travel/finance-react@0.81.9
  - @voyant-travel/hono@0.81.9
  - @voyant-travel/storage@0.81.9
  - @voyant-travel/ui@0.81.9

## 0.81.8

### Patch Changes

- @voyant-travel/core@0.81.8
- @voyant-travel/finance@0.81.8
- @voyant-travel/finance-react@0.81.8
- @voyant-travel/hono@0.81.8
- @voyant-travel/storage@0.81.8
- @voyant-travel/ui@0.81.8

## 0.81.7

### Patch Changes

- @voyant-travel/core@0.81.7
- @voyant-travel/finance@0.81.7
- @voyant-travel/finance-react@0.81.7
- @voyant-travel/hono@0.81.7
- @voyant-travel/storage@0.81.7
- @voyant-travel/ui@0.81.7

## 0.81.6

### Patch Changes

- @voyant-travel/core@0.81.6
- @voyant-travel/finance@0.81.6
- @voyant-travel/finance-react@0.81.6
- @voyant-travel/hono@0.81.6
- @voyant-travel/storage@0.81.6
- @voyant-travel/ui@0.81.6

## 0.81.5

### Patch Changes

- Updated dependencies [7d8a977]
  - @voyant-travel/core@0.81.5
  - @voyant-travel/finance@0.81.5
  - @voyant-travel/finance-react@0.81.5
  - @voyant-travel/hono@0.81.5
  - @voyant-travel/storage@0.81.5
  - @voyant-travel/ui@0.81.5

## 0.81.4

### Patch Changes

- Updated dependencies [6daefc4]
  - @voyant-travel/core@0.81.4
  - @voyant-travel/finance@0.81.4
  - @voyant-travel/finance-react@0.81.4
  - @voyant-travel/hono@0.81.4
  - @voyant-travel/storage@0.81.4
  - @voyant-travel/ui@0.81.4

## 0.81.3

### Patch Changes

- Updated dependencies [f157bcd]
  - @voyant-travel/core@0.81.3
  - @voyant-travel/finance@0.81.3
  - @voyant-travel/finance-react@0.81.3
  - @voyant-travel/hono@0.81.3
  - @voyant-travel/storage@0.81.3
  - @voyant-travel/ui@0.81.3

## 0.81.2

### Patch Changes

- @voyant-travel/core@0.81.2
- @voyant-travel/finance@0.81.2
- @voyant-travel/finance-react@0.81.2
- @voyant-travel/hono@0.81.2
- @voyant-travel/storage@0.81.2
- @voyant-travel/ui@0.81.2

## 0.81.1

### Patch Changes

- 2ce08ff: Emit a distinct proforma conversion event, convert SmartBill estimates into invoices instead of issuing duplicates, and reject new payments against void invoices.
- Updated dependencies [2ce08ff]
  - @voyant-travel/core@0.81.1
  - @voyant-travel/finance@0.81.1
  - @voyant-travel/finance-react@0.81.1
  - @voyant-travel/hono@0.81.1
  - @voyant-travel/storage@0.81.1
  - @voyant-travel/ui@0.81.1

## 0.81.0

### Patch Changes

- Updated dependencies [f35e63c]
  - @voyant-travel/core@0.81.0
  - @voyant-travel/finance@0.81.0
  - @voyant-travel/finance-react@0.81.0
  - @voyant-travel/hono@0.81.0
  - @voyant-travel/storage@0.81.0
  - @voyant-travel/ui@0.81.0

## 0.80.18

### Patch Changes

- @voyant-travel/core@0.80.18
- @voyant-travel/finance@0.80.18
- @voyant-travel/finance-react@0.80.18
- @voyant-travel/hono@0.80.18
- @voyant-travel/storage@0.80.18
- @voyant-travel/ui@0.80.18

## 0.80.17

### Patch Changes

- @voyant-travel/core@0.80.17
- @voyant-travel/finance@0.80.17
- @voyant-travel/finance-react@0.80.17
- @voyant-travel/hono@0.80.17
- @voyant-travel/storage@0.80.17
- @voyant-travel/ui@0.80.17

## 0.80.16

### Patch Changes

- Updated dependencies [dbcc0da]
  - @voyant-travel/core@0.80.16
  - @voyant-travel/finance@0.80.16
  - @voyant-travel/finance-react@0.80.16
  - @voyant-travel/hono@0.80.16
  - @voyant-travel/storage@0.80.16
  - @voyant-travel/ui@0.80.16

## 0.80.15

### Patch Changes

- @voyant-travel/core@0.80.15
- @voyant-travel/finance@0.80.15
- @voyant-travel/finance-react@0.80.15
- @voyant-travel/hono@0.80.15
- @voyant-travel/storage@0.80.15
- @voyant-travel/ui@0.80.15

## 0.80.14

### Patch Changes

- @voyant-travel/core@0.80.14
- @voyant-travel/finance@0.80.14
- @voyant-travel/finance-react@0.80.14
- @voyant-travel/hono@0.80.14
- @voyant-travel/storage@0.80.14
- @voyant-travel/ui@0.80.14

## 0.80.13

### Patch Changes

- 8dc5bc5: Preserve canonical invoice numbers from externally seeded SmartBill refs.
- Updated dependencies [55d99af]
  - @voyant-travel/core@0.80.13
  - @voyant-travel/finance@0.80.13
  - @voyant-travel/finance-react@0.80.13
  - @voyant-travel/hono@0.80.13
  - @voyant-travel/storage@0.80.13
  - @voyant-travel/ui@0.80.13

## 0.80.12

### Patch Changes

- Updated dependencies [5070731]
  - @voyant-travel/core@0.80.12
  - @voyant-travel/finance@0.80.12
  - @voyant-travel/finance-react@0.80.12
  - @voyant-travel/hono@0.80.12
  - @voyant-travel/storage@0.80.12
  - @voyant-travel/ui@0.80.12

## 0.80.11

### Patch Changes

- @voyant-travel/core@0.80.11
- @voyant-travel/finance@0.80.11
- @voyant-travel/finance-react@0.80.11
- @voyant-travel/hono@0.80.11
- @voyant-travel/storage@0.80.11
- @voyant-travel/ui@0.80.11

## 0.80.10

### Patch Changes

- @voyant-travel/core@0.80.10
- @voyant-travel/finance@0.80.10
- @voyant-travel/finance-react@0.80.10
- @voyant-travel/hono@0.80.10
- @voyant-travel/storage@0.80.10
- @voyant-travel/ui@0.80.10

## 0.80.9

### Patch Changes

- @voyant-travel/core@0.80.9
- @voyant-travel/finance@0.80.9
- @voyant-travel/finance-react@0.80.9
- @voyant-travel/hono@0.80.9
- @voyant-travel/storage@0.80.9
- @voyant-travel/ui@0.80.9

## 0.80.8

### Patch Changes

- 6ba4515: Allow invoice-from-booking requests to pre-seed invoice external refs before issued events run.
- Updated dependencies [6ba4515]
  - @voyant-travel/core@0.80.8
  - @voyant-travel/finance@0.80.8
  - @voyant-travel/finance-react@0.80.8
  - @voyant-travel/hono@0.80.8
  - @voyant-travel/storage@0.80.8
  - @voyant-travel/ui@0.80.8

## 0.80.7

### Patch Changes

- Updated dependencies [e16eb2f]
  - @voyant-travel/core@0.80.7
  - @voyant-travel/finance@0.80.7
  - @voyant-travel/finance-react@0.80.7
  - @voyant-travel/hono@0.80.7
  - @voyant-travel/storage@0.80.7
  - @voyant-travel/ui@0.80.7

## 0.80.6

### Patch Changes

- Updated dependencies [f7df51b]
  - @voyant-travel/core@0.80.6
  - @voyant-travel/finance@0.80.6
  - @voyant-travel/finance-react@0.80.6
  - @voyant-travel/hono@0.80.6
  - @voyant-travel/storage@0.80.6
  - @voyant-travel/ui@0.80.6

## 0.80.5

### Patch Changes

- Updated dependencies [f27b01f]
- Updated dependencies [d1ae342]
  - @voyant-travel/core@0.80.5
  - @voyant-travel/finance@0.80.5
  - @voyant-travel/finance-react@0.80.5
  - @voyant-travel/hono@0.80.5
  - @voyant-travel/storage@0.80.5
  - @voyant-travel/ui@0.80.5

## 0.80.4

### Patch Changes

- Updated dependencies [a411b1c]
  - @voyant-travel/core@0.80.4
  - @voyant-travel/finance@0.80.4
  - @voyant-travel/finance-react@0.80.4
  - @voyant-travel/hono@0.80.4
  - @voyant-travel/storage@0.80.4
  - @voyant-travel/ui@0.80.4

## 0.80.3

### Patch Changes

- Updated dependencies [6d816bb]
  - @voyant-travel/core@0.80.3
  - @voyant-travel/finance@0.80.3
  - @voyant-travel/finance-react@0.80.3
  - @voyant-travel/hono@0.80.3
  - @voyant-travel/storage@0.80.3
  - @voyant-travel/ui@0.80.3

## 0.80.2

### Patch Changes

- @voyant-travel/core@0.80.2
- @voyant-travel/finance@0.80.2
- @voyant-travel/finance-react@0.80.2
- @voyant-travel/hono@0.80.2
- @voyant-travel/storage@0.80.2
- @voyant-travel/ui@0.80.2

## 0.80.1

### Patch Changes

- @voyant-travel/core@0.80.1
- @voyant-travel/finance@0.80.1
- @voyant-travel/finance-react@0.80.1
- @voyant-travel/hono@0.80.1
- @voyant-travel/storage@0.80.1
- @voyant-travel/ui@0.80.1

## 0.80.0

### Patch Changes

- Updated dependencies [9473eb8]
  - @voyant-travel/core@0.80.0
  - @voyant-travel/finance@0.80.0
  - @voyant-travel/finance-react@0.80.0
  - @voyant-travel/hono@0.80.0
  - @voyant-travel/storage@0.80.0
  - @voyant-travel/ui@0.80.0

## 0.79.0

### Minor Changes

- dec5d6d: Add typed SmartBill rate-limit errors and an opt-in client circuit breaker that backs off locally after a rate-limit response.

### Patch Changes

- @voyant-travel/core@0.79.0
- @voyant-travel/finance@0.79.0
- @voyant-travel/finance-react@0.79.0
- @voyant-travel/hono@0.79.0
- @voyant-travel/storage@0.79.0
- @voyant-travel/ui@0.79.0

## 0.78.0

### Patch Changes

- @voyant-travel/core@0.78.0
- @voyant-travel/finance@0.78.0
- @voyant-travel/finance-react@0.78.0
- @voyant-travel/hono@0.78.0
- @voyant-travel/storage@0.78.0
- @voyant-travel/ui@0.78.0

## 0.77.13

### Patch Changes

- 70a32ab: Add SmartBill admin invoice sync helpers, Hono routes, and default invoice panel actions.
- Updated dependencies [70a32ab]
  - @voyant-travel/core@0.77.13
  - @voyant-travel/finance@0.77.13
  - @voyant-travel/finance-react@0.77.13
  - @voyant-travel/hono@0.77.13
  - @voyant-travel/storage@0.77.13
  - @voyant-travel/ui@0.77.13

## 0.77.12

### Patch Changes

- Updated dependencies [bf74cd4]
  - @voyant-travel/core@0.77.12
  - @voyant-travel/finance@0.77.12
  - @voyant-travel/finance-react@0.77.12
  - @voyant-travel/storage@0.77.12
  - @voyant-travel/ui@0.77.12

## 0.77.11

### Patch Changes

- Updated dependencies [437fb58]
  - @voyant-travel/core@0.77.11
  - @voyant-travel/finance@0.77.11
  - @voyant-travel/finance-react@0.77.11
  - @voyant-travel/storage@0.77.11
  - @voyant-travel/ui@0.77.11

## 0.77.10

### Patch Changes

- Updated dependencies [5751c4e]
  - @voyant-travel/core@0.77.10
  - @voyant-travel/finance@0.77.10
  - @voyant-travel/finance-react@0.77.10
  - @voyant-travel/storage@0.77.10
  - @voyant-travel/ui@0.77.10

## 0.77.9

### Patch Changes

- Updated dependencies [10e3ed5]
  - @voyant-travel/core@0.77.9
  - @voyant-travel/finance@0.77.9
  - @voyant-travel/finance-react@0.77.9
  - @voyant-travel/storage@0.77.9
  - @voyant-travel/ui@0.77.9

## 0.77.8

### Patch Changes

- 8cc89df: Add an opt-in SmartBill invoice number write-back option for mirroring issued series-numbers onto finance invoices.
- f22ae84: Request SmartBill invoice and proforma PDFs with an octet-stream accept header.
  - @voyant-travel/core@0.77.8
  - @voyant-travel/finance@0.77.8
  - @voyant-travel/finance-react@0.77.8
  - @voyant-travel/storage@0.77.8
  - @voyant-travel/ui@0.77.8

## 0.77.7

### Patch Changes

- cf47ec5: Record SmartBill PDF persistence success and failure metadata on invoice external refs.
  - @voyant-travel/core@0.77.7
  - @voyant-travel/finance@0.77.7
  - @voyant-travel/finance-react@0.77.7
  - @voyant-travel/storage@0.77.7
  - @voyant-travel/ui@0.77.7

## 0.77.6

### Patch Changes

- cbebb3f: Emit SmartBill-parseable default client and product fields from the default mapper.
  - @voyant-travel/core@0.77.6
  - @voyant-travel/finance@0.77.6
  - @voyant-travel/finance-react@0.77.6
  - @voyant-travel/storage@0.77.6
  - @voyant-travel/ui@0.77.6

## 0.77.5

### Patch Changes

- 6e522cb: Carry resolved tax names and regime codes on issued invoice event line items for downstream integrations.
- Updated dependencies [6e522cb]
  - @voyant-travel/core@0.77.5
  - @voyant-travel/finance@0.77.5
  - @voyant-travel/finance-react@0.77.5
  - @voyant-travel/storage@0.77.5
  - @voyant-travel/ui@0.77.5

## 0.77.4

### Patch Changes

- @voyant-travel/core@0.77.4
- @voyant-travel/finance@0.77.4
- @voyant-travel/finance-react@0.77.4
- @voyant-travel/storage@0.77.4
- @voyant-travel/ui@0.77.4

## 0.77.3

### Patch Changes

- @voyant-travel/core@0.77.3
- @voyant-travel/finance@0.77.3
- @voyant-travel/finance-react@0.77.3
- @voyant-travel/storage@0.77.3
- @voyant-travel/ui@0.77.3

## 0.77.2

### Patch Changes

- @voyant-travel/core@0.77.2
- @voyant-travel/finance@0.77.2
- @voyant-travel/finance-react@0.77.2
- @voyant-travel/storage@0.77.2
- @voyant-travel/ui@0.77.2

## 0.77.1

### Patch Changes

- Updated dependencies [574684d]
  - @voyant-travel/core@0.77.1
  - @voyant-travel/finance@0.77.1
  - @voyant-travel/finance-react@0.77.1
  - @voyant-travel/storage@0.77.1
  - @voyant-travel/ui@0.77.1

## 0.77.0

### Patch Changes

- Updated dependencies [1da934d]
  - @voyant-travel/core@0.77.0
  - @voyant-travel/finance@0.77.0
  - @voyant-travel/finance-react@0.77.0
  - @voyant-travel/storage@0.77.0
  - @voyant-travel/ui@0.77.0

## 0.76.0

### Patch Changes

- Updated dependencies [abf673d]
  - @voyant-travel/core@0.76.0
  - @voyant-travel/finance@0.76.0
  - @voyant-travel/finance-react@0.76.0
  - @voyant-travel/storage@0.76.0
  - @voyant-travel/ui@0.76.0

## 0.75.7

### Patch Changes

- 827c25e: Allow invoice-from-booking calls to omit `invoiceNumber`, allocate numbers from active/default series, and hand external-provider series to SmartBill-style adapters for provider-owned numbering.
- Updated dependencies [827c25e]
  - @voyant-travel/core@0.75.7
  - @voyant-travel/finance@0.75.7
  - @voyant-travel/finance-react@0.75.7
  - @voyant-travel/storage@0.75.7
  - @voyant-travel/ui@0.75.7

## 0.75.6

### Patch Changes

- @voyant-travel/core@0.75.6
- @voyant-travel/finance@0.75.6
- @voyant-travel/finance-react@0.75.6
- @voyant-travel/storage@0.75.6
- @voyant-travel/ui@0.75.6

## 0.75.5

### Patch Changes

- Updated dependencies [84a32bb]
- Updated dependencies [192c9aa]
  - @voyant-travel/core@0.75.5
  - @voyant-travel/finance@0.75.5
  - @voyant-travel/finance-react@0.75.5
  - @voyant-travel/storage@0.75.5
  - @voyant-travel/ui@0.75.5

## 0.75.4

### Patch Changes

- @voyant-travel/core@0.75.4
- @voyant-travel/finance@0.75.4
- @voyant-travel/finance-react@0.75.4
- @voyant-travel/storage@0.75.4
- @voyant-travel/ui@0.75.4

## 0.75.3

### Patch Changes

- @voyant-travel/core@0.75.3
- @voyant-travel/finance@0.75.3
- @voyant-travel/finance-react@0.75.3
- @voyant-travel/storage@0.75.3
- @voyant-travel/ui@0.75.3

## 0.75.2

### Patch Changes

- @voyant-travel/core@0.75.2
- @voyant-travel/finance@0.75.2
- @voyant-travel/finance-react@0.75.2
- @voyant-travel/storage@0.75.2
- @voyant-travel/ui@0.75.2

## 0.75.1

### Patch Changes

- @voyant-travel/core@0.75.1
- @voyant-travel/finance@0.75.1
- @voyant-travel/finance-react@0.75.1
- @voyant-travel/storage@0.75.1
- @voyant-travel/ui@0.75.1

## 0.75.0

### Patch Changes

- @voyant-travel/core@0.75.0
- @voyant-travel/finance@0.75.0
- @voyant-travel/finance-react@0.75.0
- @voyant-travel/storage@0.75.0
- @voyant-travel/ui@0.75.0

## 0.74.2

### Patch Changes

- Updated dependencies [37c08cd]
  - @voyant-travel/core@0.74.2
  - @voyant-travel/finance@0.74.2
  - @voyant-travel/finance-react@0.74.2
  - @voyant-travel/storage@0.74.2
  - @voyant-travel/ui@0.74.2

## 0.74.1

### Patch Changes

- Updated dependencies [225a483]
  - @voyant-travel/core@0.74.1
  - @voyant-travel/finance@0.74.1
  - @voyant-travel/finance-react@0.74.1
  - @voyant-travel/storage@0.74.1
  - @voyant-travel/ui@0.74.1

## 0.74.0

### Patch Changes

- @voyant-travel/core@0.74.0
- @voyant-travel/finance@0.74.0
- @voyant-travel/finance-react@0.74.0
- @voyant-travel/storage@0.74.0
- @voyant-travel/ui@0.74.0

## 0.73.1

### Patch Changes

- @voyant-travel/core@0.73.1
- @voyant-travel/finance@0.73.1
- @voyant-travel/finance-react@0.73.1
- @voyant-travel/storage@0.73.1
- @voyant-travel/ui@0.73.1

## 0.73.0

### Patch Changes

- @voyant-travel/core@0.73.0
- @voyant-travel/finance@0.73.0
- @voyant-travel/finance-react@0.73.0
- @voyant-travel/storage@0.73.0
- @voyant-travel/ui@0.73.0

## 0.72.0

### Patch Changes

- @voyant-travel/core@0.72.0
- @voyant-travel/finance@0.72.0
- @voyant-travel/finance-react@0.72.0
- @voyant-travel/storage@0.72.0
- @voyant-travel/ui@0.72.0

## 0.71.0

### Patch Changes

- @voyant-travel/core@0.71.0
- @voyant-travel/finance@0.71.0
- @voyant-travel/finance-react@0.71.0
- @voyant-travel/storage@0.71.0
- @voyant-travel/ui@0.71.0

## 0.70.0

### Patch Changes

- @voyant-travel/core@0.70.0
- @voyant-travel/finance@0.70.0
- @voyant-travel/finance-react@0.70.0
- @voyant-travel/storage@0.70.0
- @voyant-travel/ui@0.70.0

## 0.69.1

### Patch Changes

- @voyant-travel/core@0.69.1
- @voyant-travel/finance@0.69.1
- @voyant-travel/finance-react@0.69.1
- @voyant-travel/storage@0.69.1
- @voyant-travel/ui@0.69.1

## 0.69.0

### Patch Changes

- @voyant-travel/core@0.69.0
- @voyant-travel/finance@0.69.0
- @voyant-travel/finance-react@0.69.0
- @voyant-travel/storage@0.69.0
- @voyant-travel/ui@0.69.0

## 0.68.0

### Patch Changes

- @voyant-travel/core@0.68.0
- @voyant-travel/finance@0.68.0
- @voyant-travel/finance-react@0.68.0
- @voyant-travel/storage@0.68.0
- @voyant-travel/ui@0.68.0

## 0.67.0

### Patch Changes

- @voyant-travel/core@0.67.0
- @voyant-travel/finance@0.67.0
- @voyant-travel/finance-react@0.67.0
- @voyant-travel/storage@0.67.0
- @voyant-travel/ui@0.67.0

## 0.66.6

### Patch Changes

- 2a40d26: Add operator-configurable invoice FX settings, data FX exchange-rate resolution helpers, non-fatal invoice FX resolver error handling, invoice-issued event enrichment, and SmartBill exchange-rate mapping.
- Updated dependencies [2a40d26]
  - @voyant-travel/core@0.66.6
  - @voyant-travel/finance@0.66.6
  - @voyant-travel/finance-react@0.66.6
  - @voyant-travel/storage@0.66.6
  - @voyant-travel/ui@0.66.6

## 0.66.5

### Patch Changes

- @voyant-travel/core@0.66.5
- @voyant-travel/finance@0.66.5
- @voyant-travel/finance-react@0.66.5
- @voyant-travel/storage@0.66.5
- @voyant-travel/ui@0.66.5

## 0.66.4

### Patch Changes

- @voyant-travel/core@0.66.4
- @voyant-travel/finance@0.66.4
- @voyant-travel/finance-react@0.66.4
- @voyant-travel/storage@0.66.4
- @voyant-travel/ui@0.66.4

## 0.66.3

### Patch Changes

- @voyant-travel/core@0.66.3
- @voyant-travel/finance@0.66.3
- @voyant-travel/finance-react@0.66.3
- @voyant-travel/storage@0.66.3
- @voyant-travel/ui@0.66.3

## 0.66.2

### Patch Changes

- @voyant-travel/core@0.66.2
- @voyant-travel/finance@0.66.2
- @voyant-travel/finance-react@0.66.2
- @voyant-travel/storage@0.66.2
- @voyant-travel/ui@0.66.2

## 0.66.1

### Patch Changes

- @voyant-travel/core@0.66.1
- @voyant-travel/finance@0.66.1
- @voyant-travel/finance-react@0.66.1
- @voyant-travel/storage@0.66.1
- @voyant-travel/ui@0.66.1

## 0.66.0

### Patch Changes

- @voyant-travel/core@0.66.0
- @voyant-travel/finance@0.66.0
- @voyant-travel/finance-react@0.66.0
- @voyant-travel/storage@0.66.0
- @voyant-travel/ui@0.66.0

## 0.65.0

### Minor Changes

- 19496a4: Add a first-class invoice integrations slot and ship SmartBill invoice UI hooks, helpers, and a reusable panel for displaying provider external-reference state.

### Patch Changes

- @voyant-travel/core@0.65.0
- @voyant-travel/finance@0.65.0
- @voyant-travel/finance-react@0.65.0
- @voyant-travel/storage@0.65.0
- @voyant-travel/ui@0.65.0

## 0.64.1

### Patch Changes

- Updated dependencies [572dde4]
  - @voyant-travel/core@0.64.1
  - @voyant-travel/finance@0.64.1
  - @voyant-travel/storage@0.64.1

## 0.64.0

### Patch Changes

- Updated dependencies [6d0c8f3]
  - @voyant-travel/core@0.64.0
  - @voyant-travel/finance@0.64.0
  - @voyant-travel/storage@0.64.0

## 0.63.1

### Patch Changes

- @voyant-travel/core@0.63.1
- @voyant-travel/finance@0.63.1
- @voyant-travel/storage@0.63.1

## 0.63.0

### Patch Changes

- Updated dependencies [5bff9c3]
  - @voyant-travel/core@0.63.0
  - @voyant-travel/finance@0.63.0
  - @voyant-travel/storage@0.63.0

## 0.62.3

### Patch Changes

- @voyant-travel/core@0.62.3
- @voyant-travel/finance@0.62.3
- @voyant-travel/storage@0.62.3

## 0.62.2

### Patch Changes

- @voyant-travel/core@0.62.2
- @voyant-travel/finance@0.62.2
- @voyant-travel/storage@0.62.2

## 0.62.1

### Patch Changes

- @voyant-travel/core@0.62.1
- @voyant-travel/finance@0.62.1
- @voyant-travel/storage@0.62.1

## 0.62.0

### Patch Changes

- Updated dependencies [77aad68]
  - @voyant-travel/core@0.62.0
  - @voyant-travel/finance@0.62.0
  - @voyant-travel/storage@0.62.0

## 0.61.0

### Patch Changes

- @voyant-travel/core@0.61.0
- @voyant-travel/finance@0.61.0
- @voyant-travel/storage@0.61.0

## 0.60.0

### Patch Changes

- @voyant-travel/core@0.60.0
- @voyant-travel/finance@0.60.0
- @voyant-travel/storage@0.60.0

## 0.59.0

### Patch Changes

- @voyant-travel/core@0.59.0
- @voyant-travel/finance@0.59.0
- @voyant-travel/storage@0.59.0

## 0.58.0

### Patch Changes

- @voyant-travel/core@0.58.0
- @voyant-travel/finance@0.58.0
- @voyant-travel/storage@0.58.0

## 0.57.0

### Patch Changes

- @voyant-travel/core@0.57.0
- @voyant-travel/finance@0.57.0
- @voyant-travel/storage@0.57.0

## 0.56.0

### Patch Changes

- @voyant-travel/core@0.56.0
- @voyant-travel/finance@0.56.0
- @voyant-travel/storage@0.56.0

## 0.55.1

### Patch Changes

- Updated dependencies [819c847]
  - @voyant-travel/core@0.55.1
  - @voyant-travel/finance@0.55.1
  - @voyant-travel/storage@0.55.1

## 0.55.0

### Patch Changes

- @voyant-travel/core@0.55.0
- @voyant-travel/finance@0.55.0
- @voyant-travel/storage@0.55.0

## 0.54.0

### Patch Changes

- Updated dependencies [3117d27]
  - @voyant-travel/core@0.54.0
  - @voyant-travel/finance@0.54.0
  - @voyant-travel/storage@0.54.0

## 0.53.2

### Patch Changes

- @voyant-travel/core@0.53.2
- @voyant-travel/finance@0.53.2
- @voyant-travel/storage@0.53.2

## 0.53.1

### Patch Changes

- @voyant-travel/core@0.53.1
- @voyant-travel/finance@0.53.1
- @voyant-travel/storage@0.53.1

## 0.53.0

### Patch Changes

- @voyant-travel/core@0.53.0
- @voyant-travel/finance@0.53.0
- @voyant-travel/storage@0.53.0

## 0.52.4

### Patch Changes

- @voyant-travel/core@0.52.4
- @voyant-travel/finance@0.52.4
- @voyant-travel/storage@0.52.4

## 0.52.3

### Patch Changes

- Updated dependencies [9679a57]
  - @voyant-travel/core@0.52.3
  - @voyant-travel/finance@0.52.3
  - @voyant-travel/storage@0.52.3

## 0.52.2

### Patch Changes

- Updated dependencies [3e09123]
  - @voyant-travel/core@0.52.2
  - @voyant-travel/finance@0.52.2
  - @voyant-travel/storage@0.52.2

## 0.52.1

### Patch Changes

- @voyant-travel/core@0.52.1
- @voyant-travel/finance@0.52.1
- @voyant-travel/storage@0.52.1

## 0.52.0

### Patch Changes

- @voyant-travel/core@0.52.0
- @voyant-travel/finance@0.52.0
- @voyant-travel/storage@0.52.0

## 0.51.1

### Patch Changes

- @voyant-travel/core@0.51.1
- @voyant-travel/finance@0.51.1
- @voyant-travel/storage@0.51.1

## 0.51.0

### Patch Changes

- @voyant-travel/core@0.51.0
- @voyant-travel/finance@0.51.0
- @voyant-travel/storage@0.51.0

## 0.50.8

### Patch Changes

- @voyant-travel/core@0.50.8
- @voyant-travel/finance@0.50.8
- @voyant-travel/storage@0.50.8

## 0.50.7

### Patch Changes

- @voyant-travel/core@0.50.7
- @voyant-travel/finance@0.50.7
- @voyant-travel/storage@0.50.7

## 0.50.6

### Patch Changes

- Updated dependencies [c14f0a8]
  - @voyant-travel/core@0.50.6
  - @voyant-travel/finance@0.50.6
  - @voyant-travel/storage@0.50.6

## 0.50.5

### Patch Changes

- @voyant-travel/core@0.50.5
- @voyant-travel/finance@0.50.5
- @voyant-travel/storage@0.50.5

## 0.50.4

### Patch Changes

- @voyant-travel/core@0.50.4
- @voyant-travel/finance@0.50.4
- @voyant-travel/storage@0.50.4

## 0.50.3

### Patch Changes

- @voyant-travel/core@0.50.3
- @voyant-travel/finance@0.50.3
- @voyant-travel/storage@0.50.3

## 0.50.2

### Patch Changes

- @voyant-travel/core@0.50.2
- @voyant-travel/finance@0.50.2
- @voyant-travel/storage@0.50.2

## 0.50.1

### Patch Changes

- Updated dependencies [7b768c5]
  - @voyant-travel/core@0.50.1
  - @voyant-travel/finance@0.50.1
  - @voyant-travel/storage@0.50.1

## 0.50.0

### Patch Changes

- @voyant-travel/core@0.50.0
- @voyant-travel/finance@0.50.0
- @voyant-travel/storage@0.50.0

## 0.49.0

### Patch Changes

- @voyant-travel/core@0.49.0
- @voyant-travel/finance@0.49.0
- @voyant-travel/storage@0.49.0

## 0.48.0

### Patch Changes

- @voyant-travel/core@0.48.0
- @voyant-travel/finance@0.48.0
- @voyant-travel/storage@0.48.0

## 0.47.0

### Patch Changes

- Updated dependencies [65408c6]
  - @voyant-travel/core@0.47.0
  - @voyant-travel/finance@0.47.0
  - @voyant-travel/storage@0.47.0

## 0.46.0

### Patch Changes

- @voyant-travel/core@0.46.0
- @voyant-travel/finance@0.46.0
- @voyant-travel/storage@0.46.0

## 0.45.0

### Patch Changes

- @voyant-travel/core@0.45.0
- @voyant-travel/finance@0.45.0
- @voyant-travel/storage@0.45.0

## 0.44.0

### Patch Changes

- @voyant-travel/core@0.44.0
- @voyant-travel/finance@0.44.0
- @voyant-travel/storage@0.44.0

## 0.43.0

### Patch Changes

- Updated dependencies [d07215e]
  - @voyant-travel/core@0.43.0
  - @voyant-travel/finance@0.43.0
  - @voyant-travel/storage@0.43.0

## 0.42.0

### Patch Changes

- Updated dependencies [786945f]
  - @voyant-travel/core@0.42.0
  - @voyant-travel/finance@0.42.0
  - @voyant-travel/storage@0.42.0

## 0.41.3

### Patch Changes

- @voyant-travel/core@0.41.3
- @voyant-travel/finance@0.41.3
- @voyant-travel/storage@0.41.3

## 0.41.2

### Patch Changes

- @voyant-travel/core@0.41.2
- @voyant-travel/finance@0.41.2
- @voyant-travel/storage@0.41.2

## 0.41.1

### Patch Changes

- @voyant-travel/core@0.41.1
- @voyant-travel/finance@0.41.1
- @voyant-travel/storage@0.41.1

## 0.41.0

### Minor Changes

- 6d38bd0: Add SmartBill proforma conversion polling and drift reconciliation workflow factories.

### Patch Changes

- @voyant-travel/core@0.41.0
- @voyant-travel/finance@0.41.0
- @voyant-travel/storage@0.41.0

## 0.40.1

### Patch Changes

- @voyant-travel/core@0.40.1
- @voyant-travel/finance@0.40.1
- @voyant-travel/storage@0.40.1

## 0.40.0

### Minor Changes

- 4d0ff64: Add event-specific SmartBill mapping hooks, duplicate-event idempotency, error external-ref recording, and a PDF reattachment helper.

### Patch Changes

- @voyant-travel/core@0.40.0
- @voyant-travel/finance@0.40.0
- @voyant-travel/storage@0.40.0

## 0.39.0

### Patch Changes

- Updated dependencies [2297949]
  - @voyant-travel/core@0.39.0
  - @voyant-travel/finance@0.39.0
  - @voyant-travel/storage@0.39.0

## 0.38.2

### Patch Changes

- @voyant-travel/core@0.38.2
- @voyant-travel/finance@0.38.2
- @voyant-travel/storage@0.38.2

## 0.38.1

### Patch Changes

- @voyant-travel/core@0.38.1
- @voyant-travel/finance@0.38.1
- @voyant-travel/storage@0.38.1

## 0.38.0

### Patch Changes

- @voyant-travel/core@0.38.0
- @voyant-travel/finance@0.38.0
- @voyant-travel/storage@0.38.0

## 0.37.1

### Patch Changes

- @voyant-travel/core@0.37.1
- @voyant-travel/finance@0.37.1
- @voyant-travel/storage@0.37.1

## 0.37.0

### Patch Changes

- Updated dependencies [dc29b79]
- Updated dependencies [f014fd2]
  - @voyant-travel/core@0.37.0
  - @voyant-travel/finance@0.37.0
  - @voyant-travel/storage@0.37.0

## 0.36.0

### Patch Changes

- @voyant-travel/core@0.36.0
- @voyant-travel/finance@0.36.0
- @voyant-travel/storage@0.36.0

## 0.35.0

### Patch Changes

- @voyant-travel/core@0.35.0
- @voyant-travel/finance@0.35.0
- @voyant-travel/storage@0.35.0

## 0.34.0

### Patch Changes

- Updated dependencies [9095837]
  - @voyant-travel/core@0.34.0
  - @voyant-travel/finance@0.34.0
  - @voyant-travel/storage@0.34.0

## 0.33.1

### Patch Changes

- @voyant-travel/core@0.33.1
- @voyant-travel/finance@0.33.1
- @voyant-travel/storage@0.33.1

## 0.33.0

### Patch Changes

- @voyant-travel/core@0.33.0
- @voyant-travel/finance@0.33.0
- @voyant-travel/storage@0.33.0

## 0.32.3

### Patch Changes

- @voyant-travel/core@0.32.3
- @voyant-travel/finance@0.32.3
- @voyant-travel/storage@0.32.3

## 0.32.2

### Patch Changes

- @voyant-travel/core@0.32.2
- @voyant-travel/finance@0.32.2
- @voyant-travel/storage@0.32.2

## 0.32.1

### Patch Changes

- @voyant-travel/core@0.32.1
- @voyant-travel/finance@0.32.1
- @voyant-travel/storage@0.32.1

## 0.32.0

### Patch Changes

- Updated dependencies [6ea6ded]
  - @voyant-travel/core@0.32.0
  - @voyant-travel/finance@0.32.0
  - @voyant-travel/storage@0.32.0

## 0.31.4

### Patch Changes

- 4338100: Persist SmartBill invoice and proforma PDFs as finance invoice renditions and attachments when artifact storage is configured.
  - @voyant-travel/core@0.31.4
  - @voyant-travel/finance@0.31.4
  - @voyant-travel/storage@0.31.4

## 0.31.3

### Patch Changes

- @voyant-travel/core@0.31.3

## 0.31.2

### Patch Changes

- @voyant-travel/core@0.31.2

## 0.31.1

### Patch Changes

- @voyant-travel/core@0.31.1

## 0.31.0

### Patch Changes

- @voyant-travel/core@0.31.0

## 0.30.7

### Patch Changes

- @voyant-travel/core@0.30.7

## 0.30.6

### Patch Changes

- @voyant-travel/core@0.30.6

## 0.30.5

### Patch Changes

- @voyant-travel/core@0.30.5

## 0.30.4

### Patch Changes

- @voyant-travel/core@0.30.4

## 0.30.3

### Patch Changes

- @voyant-travel/core@0.30.3

## 0.30.2

### Patch Changes

- @voyant-travel/core@0.30.2

## 0.30.1

### Patch Changes

- @voyant-travel/core@0.30.1

## 0.30.0

### Patch Changes

- @voyant-travel/core@0.30.0

## 0.29.0

### Patch Changes

- @voyant-travel/core@0.29.0

## 0.28.3

### Patch Changes

- @voyant-travel/core@0.28.3

## 0.28.2

### Patch Changes

- @voyant-travel/core@0.28.2

## 0.28.1

### Patch Changes

- @voyant-travel/core@0.28.1

## 0.28.0

### Patch Changes

- @voyant-travel/core@0.28.0

## 0.27.0

### Patch Changes

- @voyant-travel/core@0.27.0

## 0.26.9

### Patch Changes

- @voyant-travel/core@0.26.9

## 0.26.8

### Patch Changes

- @voyant-travel/core@0.26.8

## 0.26.7

### Patch Changes

- 947bdfc: Make `@voyant-travel/plugin-smartbill/mock` return live-compatible SmartBill response envelopes by default, so a third-party SmartBill SDK can now point at the local mock as a sandbox (closes #436).

  Mock changes:

  - `GET /tax`, `GET /series`, `POST /invoice`, `POST /estimate`, `PUT /invoice/cancel|restore|reverse`, `DELETE /invoice`, `GET /invoice/paymentstatus`, `GET /estimate/invoices` now wrap their bodies in the live envelope shape (`status: "Ok" | "Error"`, `message`, `errorText`, plus payload fields). Errors emit `{ status: "Error", errorText, message }`.
  - `GET /series` returns the live single-letter `type` codes (`"f"` for invoice / factură, `"p"` for proforma).
  - `GET /invoice/paymentstatus` returns the live `paid: boolean` plus `invoiceTotalAmount` and a `payments` list (currently one entry per payment supplied at create time).
  - `GET /estimate/invoices` returns `areInvoicesCreated`, `series`, and `number` of the latest converted invoice.
  - `GET /invoice/pdf` and `GET /estimate/pdf` now return raw PDF bytes with `Content-Type: application/pdf`. The synthetic mock URL stays available via the `X-Mock-Pdf-Url` response header.

  Client changes (in-tree `createSmartbillClient`, breaking shape but private to this package — no other workspace package consumes the old shape):

  - `viewPdf` now returns `{ bytes: Uint8Array; contentType: string }`. Added `viewInvoicePdf` (same behaviour) and a new `viewEstimatePdf` for proforma PDFs. `viewPdf` is kept as an alias for `viewInvoicePdf`.
  - `getPaymentStatus` now returns the live envelope (`paid: boolean`, `invoiceTotalAmount`, `paidAmount`, `unpaidAmount`, `payments`, `status`, `message`, `errorText`). Callers should read `paid` instead of comparing `status === "paid"`. The settlement poller has been updated accordingly.
  - New methods: `restoreInvoice`, `listTaxes`, `listSeries`, `listEstimateInvoices`.
  - The client now treats any envelope with `status === "Error"` or a non-empty `errorText` as a thrown error, matching live SmartBill behaviour.

  `SmartbillFetch` is extended with `arrayBuffer()` and an optional `headers.get(name)` accessor — purely additive on top of the existing `fetch`-shape. New exported types: `SmartbillEnvelope`, `SmartbillTaxesResponse`, `SmartbillSeriesResponse`, `SmartbillEstimateInvoicesResponse`, `SmartbillPaymentEntry`.

  - @voyant-travel/core@0.26.7

## 0.26.6

### Patch Changes

- @voyant-travel/core@0.26.6

## 0.26.5

### Patch Changes

- @voyant-travel/core@0.26.5

## 0.26.4

### Patch Changes

- @voyant-travel/core@0.26.4

## 0.26.3

### Patch Changes

- @voyant-travel/core@0.26.3

## 0.26.2

### Patch Changes

- @voyant-travel/core@0.26.2

## 0.26.1

### Patch Changes

- @voyant-travel/core@0.26.1

## 0.26.0

### Minor Changes

- 03d64ea: Add a supported local SmartBill mock for safe development and end-to-end billing tests.

  The new `@voyant-travel/plugin-smartbill/mock` entrypoint exposes a stateful
  SmartBill-compatible mock with in-process `fetch`, a localhost HTTP listener,
  deterministic document numbering, PDF URLs marked as test documents, invoice
  status changes, and proforma conversion polling.

### Patch Changes

- @voyant-travel/core@0.26.0

## 0.25.0

### Patch Changes

- @voyant-travel/core@0.25.0

## 0.24.3

### Patch Changes

- @voyant-travel/core@0.24.3

## 0.24.2

### Patch Changes

- @voyant-travel/core@0.24.2

## 0.24.1

### Patch Changes

- @voyant-travel/core@0.24.1

## 0.24.0

### Patch Changes

- @voyant-travel/core@0.24.0

## 0.23.0

### Patch Changes

- @voyant-travel/core@0.23.0

## 0.22.0

### Patch Changes

- @voyant-travel/core@0.22.0

## 0.21.1

### Patch Changes

- @voyant-travel/core@0.21.1

## 0.21.0

### Patch Changes

- @voyant-travel/core@0.21.0

## 0.20.0

### Patch Changes

- @voyant-travel/core@0.20.0

## 0.19.0

### Patch Changes

- @voyant-travel/core@0.19.0

## 0.18.0

### Patch Changes

- @voyant-travel/core@0.18.0

## 0.17.0

### Patch Changes

- Updated dependencies [66d722d]
  - @voyant-travel/core@0.17.0

## 0.16.0

### Patch Changes

- @voyant-travel/core@0.16.0

## 0.15.0

### Patch Changes

- @voyant-travel/core@0.15.0

## 0.14.0

### Patch Changes

- @voyant-travel/core@0.14.0

## 0.13.0

### Patch Changes

- @voyant-travel/core@0.13.0

## 0.12.0

### Patch Changes

- @voyant-travel/core@0.12.0

## 0.11.0

### Patch Changes

- @voyant-travel/core@0.11.0

## 0.10.0

### Patch Changes

- @voyant-travel/core@0.10.0

## 0.9.0

### Patch Changes

- @voyant-travel/core@0.9.0

## 0.8.0

### Patch Changes

- @voyant-travel/core@0.8.0

## 0.7.0

### Patch Changes

- @voyant-travel/core@0.7.0

## 0.6.9

### Patch Changes

- @voyant-travel/core@0.6.9

## 0.6.8

### Patch Changes

- @voyant-travel/core@0.6.8

## 0.6.7

### Patch Changes

- @voyant-travel/core@0.6.7

## 0.6.6

### Patch Changes

- @voyant-travel/core@0.6.6

## 0.6.5

### Patch Changes

- @voyant-travel/core@0.6.5

## 0.6.4

### Patch Changes

- @voyant-travel/core@0.6.4

## 0.6.3

### Patch Changes

- Updated dependencies [d3c6937]
  - @voyant-travel/core@0.6.3

## 0.6.2

### Patch Changes

- @voyant-travel/core@0.6.2

## 0.6.1

### Patch Changes

- @voyant-travel/core@0.6.1

## 0.6.0

### Patch Changes

- @voyant-travel/core@0.6.0

## 0.5.0

### Patch Changes

- @voyant-travel/core@0.5.0

## 0.4.5

### Patch Changes

- Updated dependencies [e3f6e72]
  - @voyant-travel/core@0.4.5

## 0.4.4

### Patch Changes

- @voyant-travel/core@0.4.4

## 0.4.3

### Patch Changes

- @voyant-travel/core@0.4.3

## 0.4.2

### Patch Changes

- @voyant-travel/core@0.4.2

## 0.4.1

### Patch Changes

- @voyant-travel/core@0.4.1

## 0.4.0

### Patch Changes

- e84fe0f: Add first-class invoice settlement polling and reconciliation.

  - add `POST /v1/admin/finance/invoices/:id/poll-settlement` with typed polling
    and reconciliation results
  - sync provider settlement state back onto `invoice_external_refs`
  - reconcile newly observed paid amounts into completed Voyant payments without
    over-applying across multiple provider refs
  - add `createSmartbillInvoiceSettlementPoller()` in
    `@voyant-travel/plugin-smartbill`
  - @voyant-travel/core@0.4.0

## 0.3.1

### Patch Changes

- @voyant-travel/core@0.3.1

## 0.3.0

### Patch Changes

- @voyant-travel/core@0.3.0

## 0.2.0

### Patch Changes

- 99c6dac: Fix the published package layout so plugin build output lands at `dist/*` without leaking `dist/src/*` or compiled tests into npm tarballs.
  - @voyant-travel/core@0.2.0

## 0.1.1

### Patch Changes

- @voyant-travel/core@0.1.1
