# @voyantjs/bookings-ui

## 0.75.4

### Patch Changes

- 3f82d98: Add a booking payment reconciliation banner that compares invoice paid totals, completed payment rows, and paid schedule rows.
  - @voyantjs/availability-react@0.75.4
  - @voyantjs/bookings-react@0.75.4
  - @voyantjs/catalog@0.75.4
  - @voyantjs/catalog-react@0.75.4
  - @voyantjs/crm-react@0.75.4
  - @voyantjs/crm-ui@0.75.4
  - @voyantjs/extras-react@0.75.4
  - @voyantjs/finance-react@0.75.4
  - @voyantjs/i18n@0.75.4
  - @voyantjs/identity-react@0.75.4
  - @voyantjs/legal-react@0.75.4
  - @voyantjs/pricing-react@0.75.4
  - @voyantjs/products-react@0.75.4
  - @voyantjs/suppliers-react@0.75.4
  - @voyantjs/ui@0.75.4

## 0.75.3

### Patch Changes

- Updated dependencies [38167cd]
  - @voyantjs/availability-react@0.75.3
  - @voyantjs/bookings-react@0.75.3
  - @voyantjs/catalog@0.75.3
  - @voyantjs/catalog-react@0.75.3
  - @voyantjs/crm-react@0.75.3
  - @voyantjs/crm-ui@0.75.3
  - @voyantjs/extras-react@0.75.3
  - @voyantjs/finance-react@0.75.3
  - @voyantjs/i18n@0.75.3
  - @voyantjs/identity-react@0.75.3
  - @voyantjs/legal-react@0.75.3
  - @voyantjs/pricing-react@0.75.3
  - @voyantjs/products-react@0.75.3
  - @voyantjs/suppliers-react@0.75.3
  - @voyantjs/ui@0.75.3

## 0.75.2

### Patch Changes

- 08e7f32: Build default attachment download links from the active API provider base URL.
  - @voyantjs/availability-react@0.75.2
  - @voyantjs/bookings-react@0.75.2
  - @voyantjs/catalog@0.75.2
  - @voyantjs/catalog-react@0.75.2
  - @voyantjs/crm-react@0.75.2
  - @voyantjs/crm-ui@0.75.2
  - @voyantjs/extras-react@0.75.2
  - @voyantjs/finance-react@0.75.2
  - @voyantjs/i18n@0.75.2
  - @voyantjs/identity-react@0.75.2
  - @voyantjs/legal-react@0.75.2
  - @voyantjs/pricing-react@0.75.2
  - @voyantjs/products-react@0.75.2
  - @voyantjs/suppliers-react@0.75.2
  - @voyantjs/ui@0.75.2

## 0.75.1

### Patch Changes

- 4728f91: Link BookingQuickViewSheet invoice and contract rows to latest attachment downloads when available.
  - @voyantjs/availability-react@0.75.1
  - @voyantjs/bookings-react@0.75.1
  - @voyantjs/catalog@0.75.1
  - @voyantjs/catalog-react@0.75.1
  - @voyantjs/crm-react@0.75.1
  - @voyantjs/crm-ui@0.75.1
  - @voyantjs/extras-react@0.75.1
  - @voyantjs/finance-react@0.75.1
  - @voyantjs/i18n@0.75.1
  - @voyantjs/identity-react@0.75.1
  - @voyantjs/legal-react@0.75.1
  - @voyantjs/pricing-react@0.75.1
  - @voyantjs/products-react@0.75.1
  - @voyantjs/suppliers-react@0.75.1
  - @voyantjs/ui@0.75.1

## 0.75.0

### Patch Changes

- @voyantjs/availability-react@0.75.0
- @voyantjs/bookings-react@0.75.0
- @voyantjs/catalog@0.75.0
- @voyantjs/catalog-react@0.75.0
- @voyantjs/crm-react@0.75.0
- @voyantjs/crm-ui@0.75.0
- @voyantjs/extras-react@0.75.0
- @voyantjs/finance-react@0.75.0
- @voyantjs/i18n@0.75.0
- @voyantjs/identity-react@0.75.0
- @voyantjs/legal-react@0.75.0
- @voyantjs/pricing-react@0.75.0
- @voyantjs/products-react@0.75.0
- @voyantjs/suppliers-react@0.75.0
- @voyantjs/ui@0.75.0

## 0.74.2

### Patch Changes

- @voyantjs/availability-react@0.74.2
- @voyantjs/bookings-react@0.74.2
- @voyantjs/catalog@0.74.2
- @voyantjs/catalog-react@0.74.2
- @voyantjs/crm-react@0.74.2
- @voyantjs/crm-ui@0.74.2
- @voyantjs/extras-react@0.74.2
- @voyantjs/finance-react@0.74.2
- @voyantjs/i18n@0.74.2
- @voyantjs/identity-react@0.74.2
- @voyantjs/legal-react@0.74.2
- @voyantjs/pricing-react@0.74.2
- @voyantjs/products-react@0.74.2
- @voyantjs/suppliers-react@0.74.2
- @voyantjs/ui@0.74.2

## 0.74.1

### Patch Changes

- Updated dependencies [225a483]
  - @voyantjs/availability-react@0.74.1
  - @voyantjs/bookings-react@0.74.1
  - @voyantjs/catalog@0.74.1
  - @voyantjs/catalog-react@0.74.1
  - @voyantjs/crm-react@0.74.1
  - @voyantjs/crm-ui@0.74.1
  - @voyantjs/extras-react@0.74.1
  - @voyantjs/finance-react@0.74.1
  - @voyantjs/i18n@0.74.1
  - @voyantjs/identity-react@0.74.1
  - @voyantjs/legal-react@0.74.1
  - @voyantjs/pricing-react@0.74.1
  - @voyantjs/products-react@0.74.1
  - @voyantjs/suppliers-react@0.74.1
  - @voyantjs/ui@0.74.1

## 0.74.0

### Minor Changes

- 36e3ac8: Add `BookingQuickViewSheet` — a side-sheet for peeking at a booking from places like allocation grids, calendars, or activity feeds without leaving the current page (issue #1083). Takes `{ bookingId, open, onOpenChange, onViewFull }` and renders the canonical operator summary: booking number + status badge, sell amount, dates / pax row, payer name + phone, then five quick sections — **Travelers** (with category badges and `count/expected` counter), **Payments** (Paid / Remaining derived from completed payments vs. sell amount), **Invoices**, **Payment schedule** (with `paid/total paid` counter), and **Contracts** (with the "Not generated." empty state) — plus a "View full booking" footer that hands the loaded `BookingRecord` back to the host. Lets operator templates drop their local clones.

### Patch Changes

- @voyantjs/availability-react@0.74.0
- @voyantjs/bookings-react@0.74.0
- @voyantjs/catalog@0.74.0
- @voyantjs/catalog-react@0.74.0
- @voyantjs/crm-react@0.74.0
- @voyantjs/crm-ui@0.74.0
- @voyantjs/extras-react@0.74.0
- @voyantjs/finance-react@0.74.0
- @voyantjs/i18n@0.74.0
- @voyantjs/identity-react@0.74.0
- @voyantjs/legal-react@0.74.0
- @voyantjs/pricing-react@0.74.0
- @voyantjs/products-react@0.74.0
- @voyantjs/suppliers-react@0.74.0
- @voyantjs/ui@0.74.0

## 0.73.1

### Patch Changes

- @voyantjs/availability-react@0.73.1
- @voyantjs/bookings-react@0.73.1
- @voyantjs/catalog@0.73.1
- @voyantjs/catalog-react@0.73.1
- @voyantjs/crm-react@0.73.1
- @voyantjs/crm-ui@0.73.1
- @voyantjs/extras-react@0.73.1
- @voyantjs/finance-react@0.73.1
- @voyantjs/i18n@0.73.1
- @voyantjs/identity-react@0.73.1
- @voyantjs/legal-react@0.73.1
- @voyantjs/pricing-react@0.73.1
- @voyantjs/products-react@0.73.1
- @voyantjs/suppliers-react@0.73.1
- @voyantjs/ui@0.73.1

## 0.73.0

### Patch Changes

- Updated dependencies [856da86]
  - @voyantjs/availability-react@0.73.0
  - @voyantjs/bookings-react@0.73.0
  - @voyantjs/catalog@0.73.0
  - @voyantjs/catalog-react@0.73.0
  - @voyantjs/crm-react@0.73.0
  - @voyantjs/crm-ui@0.73.0
  - @voyantjs/extras-react@0.73.0
  - @voyantjs/finance-react@0.73.0
  - @voyantjs/i18n@0.73.0
  - @voyantjs/identity-react@0.73.0
  - @voyantjs/legal-react@0.73.0
  - @voyantjs/pricing-react@0.73.0
  - @voyantjs/products-react@0.73.0
  - @voyantjs/suppliers-react@0.73.0
  - @voyantjs/ui@0.73.0

## 0.72.0

### Patch Changes

- @voyantjs/availability-react@0.72.0
- @voyantjs/bookings-react@0.72.0
- @voyantjs/catalog@0.72.0
- @voyantjs/catalog-react@0.72.0
- @voyantjs/crm-react@0.72.0
- @voyantjs/crm-ui@0.72.0
- @voyantjs/extras-react@0.72.0
- @voyantjs/finance-react@0.72.0
- @voyantjs/i18n@0.72.0
- @voyantjs/identity-react@0.72.0
- @voyantjs/legal-react@0.72.0
- @voyantjs/pricing-react@0.72.0
- @voyantjs/products-react@0.72.0
- @voyantjs/suppliers-react@0.72.0
- @voyantjs/ui@0.72.0

## 0.71.0

### Patch Changes

- Updated dependencies [9bdc9a6]
  - @voyantjs/availability-react@0.71.0
  - @voyantjs/bookings-react@0.71.0
  - @voyantjs/catalog@0.71.0
  - @voyantjs/catalog-react@0.71.0
  - @voyantjs/crm-react@0.71.0
  - @voyantjs/crm-ui@0.71.0
  - @voyantjs/extras-react@0.71.0
  - @voyantjs/finance-react@0.71.0
  - @voyantjs/i18n@0.71.0
  - @voyantjs/identity-react@0.71.0
  - @voyantjs/legal-react@0.71.0
  - @voyantjs/pricing-react@0.71.0
  - @voyantjs/products-react@0.71.0
  - @voyantjs/suppliers-react@0.71.0
  - @voyantjs/ui@0.71.0

## 0.70.0

### Patch Changes

- Updated dependencies [09d5f82]
  - @voyantjs/availability-react@0.70.0
  - @voyantjs/bookings-react@0.70.0
  - @voyantjs/catalog@0.70.0
  - @voyantjs/catalog-react@0.70.0
  - @voyantjs/crm-react@0.70.0
  - @voyantjs/crm-ui@0.70.0
  - @voyantjs/extras-react@0.70.0
  - @voyantjs/finance-react@0.70.0
  - @voyantjs/i18n@0.70.0
  - @voyantjs/identity-react@0.70.0
  - @voyantjs/legal-react@0.70.0
  - @voyantjs/pricing-react@0.70.0
  - @voyantjs/products-react@0.70.0
  - @voyantjs/suppliers-react@0.70.0
  - @voyantjs/ui@0.70.0

## 0.69.1

### Patch Changes

- @voyantjs/availability-react@0.69.1
- @voyantjs/bookings-react@0.69.1
- @voyantjs/catalog@0.69.1
- @voyantjs/catalog-react@0.69.1
- @voyantjs/crm-react@0.69.1
- @voyantjs/crm-ui@0.69.1
- @voyantjs/extras-react@0.69.1
- @voyantjs/finance-react@0.69.1
- @voyantjs/i18n@0.69.1
- @voyantjs/identity-react@0.69.1
- @voyantjs/legal-react@0.69.1
- @voyantjs/pricing-react@0.69.1
- @voyantjs/products-react@0.69.1
- @voyantjs/suppliers-react@0.69.1
- @voyantjs/ui@0.69.1

## 0.69.0

### Patch Changes

- @voyantjs/availability-react@0.69.0
- @voyantjs/bookings-react@0.69.0
- @voyantjs/catalog@0.69.0
- @voyantjs/catalog-react@0.69.0
- @voyantjs/crm-react@0.69.0
- @voyantjs/crm-ui@0.69.0
- @voyantjs/extras-react@0.69.0
- @voyantjs/finance-react@0.69.0
- @voyantjs/i18n@0.69.0
- @voyantjs/identity-react@0.69.0
- @voyantjs/legal-react@0.69.0
- @voyantjs/pricing-react@0.69.0
- @voyantjs/products-react@0.69.0
- @voyantjs/suppliers-react@0.69.0
- @voyantjs/ui@0.69.0

## 0.68.0

### Patch Changes

- @voyantjs/availability-react@0.68.0
- @voyantjs/bookings-react@0.68.0
- @voyantjs/catalog@0.68.0
- @voyantjs/catalog-react@0.68.0
- @voyantjs/crm-react@0.68.0
- @voyantjs/crm-ui@0.68.0
- @voyantjs/extras-react@0.68.0
- @voyantjs/finance-react@0.68.0
- @voyantjs/i18n@0.68.0
- @voyantjs/identity-react@0.68.0
- @voyantjs/legal-react@0.68.0
- @voyantjs/pricing-react@0.68.0
- @voyantjs/products-react@0.68.0
- @voyantjs/suppliers-react@0.68.0
- @voyantjs/ui@0.68.0

## 0.67.0

### Patch Changes

- @voyantjs/availability-react@0.67.0
- @voyantjs/bookings-react@0.67.0
- @voyantjs/catalog@0.67.0
- @voyantjs/catalog-react@0.67.0
- @voyantjs/crm-react@0.67.0
- @voyantjs/crm-ui@0.67.0
- @voyantjs/extras-react@0.67.0
- @voyantjs/finance-react@0.67.0
- @voyantjs/i18n@0.67.0
- @voyantjs/identity-react@0.67.0
- @voyantjs/legal-react@0.67.0
- @voyantjs/pricing-react@0.67.0
- @voyantjs/products-react@0.67.0
- @voyantjs/suppliers-react@0.67.0
- @voyantjs/ui@0.67.0

## 0.66.6

### Patch Changes

- Updated dependencies [f6634ff]
  - @voyantjs/availability-react@0.66.6
  - @voyantjs/bookings-react@0.66.6
  - @voyantjs/catalog@0.66.6
  - @voyantjs/catalog-react@0.66.6
  - @voyantjs/crm-react@0.66.6
  - @voyantjs/crm-ui@0.66.6
  - @voyantjs/extras-react@0.66.6
  - @voyantjs/finance-react@0.66.6
  - @voyantjs/i18n@0.66.6
  - @voyantjs/identity-react@0.66.6
  - @voyantjs/legal-react@0.66.6
  - @voyantjs/pricing-react@0.66.6
  - @voyantjs/products-react@0.66.6
  - @voyantjs/suppliers-react@0.66.6
  - @voyantjs/ui@0.66.6

## 0.66.5

### Patch Changes

- @voyantjs/availability-react@0.66.5
- @voyantjs/bookings-react@0.66.5
- @voyantjs/catalog@0.66.5
- @voyantjs/catalog-react@0.66.5
- @voyantjs/crm-react@0.66.5
- @voyantjs/crm-ui@0.66.5
- @voyantjs/extras-react@0.66.5
- @voyantjs/finance-react@0.66.5
- @voyantjs/i18n@0.66.5
- @voyantjs/identity-react@0.66.5
- @voyantjs/legal-react@0.66.5
- @voyantjs/pricing-react@0.66.5
- @voyantjs/products-react@0.66.5
- @voyantjs/suppliers-react@0.66.5
- @voyantjs/ui@0.66.5

## 0.66.4

### Patch Changes

- @voyantjs/availability-react@0.66.4
- @voyantjs/bookings-react@0.66.4
- @voyantjs/catalog@0.66.4
- @voyantjs/catalog-react@0.66.4
- @voyantjs/crm-react@0.66.4
- @voyantjs/crm-ui@0.66.4
- @voyantjs/extras-react@0.66.4
- @voyantjs/finance-react@0.66.4
- @voyantjs/i18n@0.66.4
- @voyantjs/identity-react@0.66.4
- @voyantjs/legal-react@0.66.4
- @voyantjs/pricing-react@0.66.4
- @voyantjs/products-react@0.66.4
- @voyantjs/suppliers-react@0.66.4
- @voyantjs/ui@0.66.4

## 0.66.3

### Patch Changes

- @voyantjs/availability-react@0.66.3
- @voyantjs/bookings-react@0.66.3
- @voyantjs/catalog@0.66.3
- @voyantjs/catalog-react@0.66.3
- @voyantjs/crm-react@0.66.3
- @voyantjs/crm-ui@0.66.3
- @voyantjs/extras-react@0.66.3
- @voyantjs/finance-react@0.66.3
- @voyantjs/i18n@0.66.3
- @voyantjs/identity-react@0.66.3
- @voyantjs/legal-react@0.66.3
- @voyantjs/pricing-react@0.66.3
- @voyantjs/products-react@0.66.3
- @voyantjs/suppliers-react@0.66.3
- @voyantjs/ui@0.66.3

## 0.66.2

### Patch Changes

- Updated dependencies [3608633]
  - @voyantjs/availability-react@0.66.2
  - @voyantjs/bookings-react@0.66.2
  - @voyantjs/catalog@0.66.2
  - @voyantjs/catalog-react@0.66.2
  - @voyantjs/crm-react@0.66.2
  - @voyantjs/crm-ui@0.66.2
  - @voyantjs/extras-react@0.66.2
  - @voyantjs/finance-react@0.66.2
  - @voyantjs/i18n@0.66.2
  - @voyantjs/identity-react@0.66.2
  - @voyantjs/legal-react@0.66.2
  - @voyantjs/pricing-react@0.66.2
  - @voyantjs/products-react@0.66.2
  - @voyantjs/suppliers-react@0.66.2
  - @voyantjs/ui@0.66.2

## 0.66.1

### Patch Changes

- @voyantjs/availability-react@0.66.1
- @voyantjs/bookings-react@0.66.1
- @voyantjs/catalog@0.66.1
- @voyantjs/catalog-react@0.66.1
- @voyantjs/crm-react@0.66.1
- @voyantjs/crm-ui@0.66.1
- @voyantjs/extras-react@0.66.1
- @voyantjs/finance-react@0.66.1
- @voyantjs/i18n@0.66.1
- @voyantjs/identity-react@0.66.1
- @voyantjs/legal-react@0.66.1
- @voyantjs/pricing-react@0.66.1
- @voyantjs/products-react@0.66.1
- @voyantjs/suppliers-react@0.66.1
- @voyantjs/ui@0.66.1

## 0.66.0

### Patch Changes

- Updated dependencies [a74089c]
  - @voyantjs/availability-react@0.66.0
  - @voyantjs/bookings-react@0.66.0
  - @voyantjs/catalog@0.66.0
  - @voyantjs/catalog-react@0.66.0
  - @voyantjs/crm-react@0.66.0
  - @voyantjs/crm-ui@0.66.0
  - @voyantjs/extras-react@0.66.0
  - @voyantjs/finance-react@0.66.0
  - @voyantjs/i18n@0.66.0
  - @voyantjs/identity-react@0.66.0
  - @voyantjs/legal-react@0.66.0
  - @voyantjs/pricing-react@0.66.0
  - @voyantjs/products-react@0.66.0
  - @voyantjs/suppliers-react@0.66.0
  - @voyantjs/ui@0.66.0

## 0.65.0

### Patch Changes

- @voyantjs/availability-react@0.65.0
- @voyantjs/bookings-react@0.65.0
- @voyantjs/catalog@0.65.0
- @voyantjs/catalog-react@0.65.0
- @voyantjs/crm-react@0.65.0
- @voyantjs/crm-ui@0.65.0
- @voyantjs/extras-react@0.65.0
- @voyantjs/finance-react@0.65.0
- @voyantjs/i18n@0.65.0
- @voyantjs/identity-react@0.65.0
- @voyantjs/legal-react@0.65.0
- @voyantjs/pricing-react@0.65.0
- @voyantjs/products-react@0.65.0
- @voyantjs/suppliers-react@0.65.0
- @voyantjs/ui@0.65.0

## 0.64.1

### Patch Changes

- @voyantjs/availability-react@0.64.1
- @voyantjs/bookings-react@0.64.1
- @voyantjs/catalog@0.64.1
- @voyantjs/catalog-react@0.64.1
- @voyantjs/crm-react@0.64.1
- @voyantjs/crm-ui@0.64.1
- @voyantjs/extras-react@0.64.1
- @voyantjs/finance-react@0.64.1
- @voyantjs/i18n@0.64.1
- @voyantjs/identity-react@0.64.1
- @voyantjs/legal-react@0.64.1
- @voyantjs/pricing-react@0.64.1
- @voyantjs/products-react@0.64.1
- @voyantjs/suppliers-react@0.64.1
- @voyantjs/ui@0.64.1

## 0.64.0

### Patch Changes

- @voyantjs/availability-react@0.64.0
- @voyantjs/bookings-react@0.64.0
- @voyantjs/catalog@0.64.0
- @voyantjs/catalog-react@0.64.0
- @voyantjs/crm-react@0.64.0
- @voyantjs/crm-ui@0.64.0
- @voyantjs/extras-react@0.64.0
- @voyantjs/finance-react@0.64.0
- @voyantjs/i18n@0.64.0
- @voyantjs/identity-react@0.64.0
- @voyantjs/legal-react@0.64.0
- @voyantjs/pricing-react@0.64.0
- @voyantjs/products-react@0.64.0
- @voyantjs/suppliers-react@0.64.0
- @voyantjs/ui@0.64.0

## 0.63.1

### Patch Changes

- a938b32: Fix booking-create room assignment and per-person capacity labels for finite slots.
  - @voyantjs/availability-react@0.63.1
  - @voyantjs/bookings-react@0.63.1
  - @voyantjs/catalog@0.63.1
  - @voyantjs/catalog-react@0.63.1
  - @voyantjs/crm-react@0.63.1
  - @voyantjs/crm-ui@0.63.1
  - @voyantjs/extras-react@0.63.1
  - @voyantjs/finance-react@0.63.1
  - @voyantjs/i18n@0.63.1
  - @voyantjs/identity-react@0.63.1
  - @voyantjs/legal-react@0.63.1
  - @voyantjs/pricing-react@0.63.1
  - @voyantjs/products-react@0.63.1
  - @voyantjs/suppliers-react@0.63.1
  - @voyantjs/ui@0.63.1

## 0.63.0

### Minor Changes

- 5bff9c3: Booking detail page becomes the canonical layout; booking items keep a catalog snapshot.

  `@voyantjs/bookings-ui`

  - `BookingDetailPage` now hosts the full operator-grade layout: action menu (edit / change status / cancel / delete), summary card (sell / cost+margin / dates / travelers / person / organization / created / updated), tabs (Overview, Travelers, Payments, optional Invoices, Suppliers, Documents, Activity, optional Ledger). New slot props `header`, `afterSummary`, `overviewStart`, `overviewEnd`, `travelersStart`, `financeStart`, `financeEnd`, `documents`, `activityEnd`, plus `invoicesTab` / `ledgerTab` (`{ label?, content }`) — templates compose template-owned cards via these slots. New callbacks `onPersonOpen`, `onOrganizationOpen`, `onRecordPayment` and a `hideBreadcrumb` flag for hosts that own their own breadcrumb chrome.
  - `BookingBillingContextCard` now hydrates from CRM (`usePerson` / `useOrganization`) when the booking's contact snapshot is empty, and renders its own `Edit` button wired to `BookingBillingDialog`.
  - `BookingItemList` shows `productNameSnapshot` as the row title with `optionNameSnapshot · unitNameSnapshot` as the subtitle, and `departureLabelSnapshot` wins over derived date formatting. The `Assigned travelers` panel was removed from the expanded row (the Travelers tab already covers it).
  - `SupplierStatusList` deduplicates visually identical rows (same `supplierServiceId` / `serviceName` / `status` / cost) and shows `× N` with a summed cost; edit pencil opens the head row.
  - Default tab label change: "Finance" → "Payments". New `tabInvoices` / `tabLedger` keys. Inline breadcrumb suppressible via `hideBreadcrumb`.
  - `BookingWorkspacePage` removed (no consumers; the canonical detail page now covers the same surface).
  - New: `BookingDetailTabSlot` type export.

  `@voyantjs/bookings`

  - `booking_items` gains catalog snapshot columns (all `text`, nullable, FK-less): `product_name_snapshot`, `option_name_snapshot`, `unit_name_snapshot`, `departure_label_snapshot`, and a decoupled `availability_slot_id` reference. Snapshots are written at create time so operators can always see "what the customer bought" — even on catalog-less deployments (OTA), and even if the catalog row is later deleted or renamed.
  - `convertProductToBooking` populates the snapshot columns and slot-id from `productsRef` / `productOptionsRef` / `optionUnitsRef` / `availabilitySlotsRef`. Caller-supplied `*Snapshot` / timing values win for OTA flows that bring their own data.
  - `createItem` / `updateItem` (template add-item path) resolve snapshots via a new internal helper. `updateItem` only refreshes snapshots when a foreign id changes — existing snapshots are the historical record and aren't overwritten on catalog renames.
  - `listItems` returns the snapshot fields with a plain select (no JOIN). `listBookingItemsForSummaries` (powers the bookings list) now COALESCEs the snapshot over the current catalog name.
  - `BOOKING_ITEM_MUTATION_FIELDS` allowlist extended for the new columns.

  `@voyantjs/bookings-react`

  - `BookingItemRecord` exposes `availabilitySlotId`, `productNameSnapshot`, `optionNameSnapshot`, `unitNameSnapshot`, `departureLabelSnapshot`.
  - `BookingsListFilters` adds `availabilitySlotId` so the list page can filter to a specific departure.

  Bookings list page (`BookingList` + `BookingListFiltersPopover`)

  - New **Lead** column (booking's `contactFirstName contactLastName`, falls back to `contactEmail`) and **Created** column (`createdAt`, sortable). `createdAt` joins the sortable-fields union (was previously omitted).
  - New **Departure** filter scoped to the selected product. Picker pulls slots via `useSlots({ productId, limit: 50 })` and labels them with `Intl.DateTimeFormat` in the slot's own timezone so the operator sees what the customer sees. Disabled until a product is picked; auto-clears when the product changes. New i18n keys: `columns.lead`, `columns.createdAt`, `filters.departureLabel` / `departure` / `departureEmpty` / `departureNeedsProduct` (EN + RO).
  - `bookingListQuerySchema` accepts an `availabilitySlotId` query param (server); `listBookings` ANDs it into the per-item EXISTS subquery via `booking_items.availability_slot_id` (relies on the snapshot column added by the same release).

  Templates that own a booking_items table must add the new columns: see `templates/operator/migrations/0026_booking_item_snapshots.sql` for the canonical migration shape (plus optional backfill migrations 0027 + 0028 to populate snapshots from the catalog and from `metadata.availabilitySlotId` for existing rows).

### Patch Changes

- Updated dependencies [5bff9c3]
- Updated dependencies [5bff9c3]
- Updated dependencies [5bff9c3]
- Updated dependencies [5bff9c3]
  - @voyantjs/availability-react@0.63.0
  - @voyantjs/bookings-react@0.63.0
  - @voyantjs/catalog@0.63.0
  - @voyantjs/catalog-react@0.63.0
  - @voyantjs/crm-react@0.63.0
  - @voyantjs/crm-ui@0.63.0
  - @voyantjs/extras-react@0.63.0
  - @voyantjs/finance-react@0.63.0
  - @voyantjs/i18n@0.63.0
  - @voyantjs/identity-react@0.63.0
  - @voyantjs/legal-react@0.63.0
  - @voyantjs/pricing-react@0.63.0
  - @voyantjs/products-react@0.63.0
  - @voyantjs/suppliers-react@0.63.0
  - @voyantjs/ui@0.63.0

## 0.62.3

### Patch Changes

- @voyantjs/availability-react@0.62.3
- @voyantjs/bookings-react@0.62.3
- @voyantjs/catalog@0.62.3
- @voyantjs/catalog-react@0.62.3
- @voyantjs/crm-react@0.62.3
- @voyantjs/crm-ui@0.62.3
- @voyantjs/extras-react@0.62.3
- @voyantjs/finance-react@0.62.3
- @voyantjs/i18n@0.62.3
- @voyantjs/identity-react@0.62.3
- @voyantjs/legal-react@0.62.3
- @voyantjs/pricing-react@0.62.3
- @voyantjs/products-react@0.62.3
- @voyantjs/suppliers-react@0.62.3
- @voyantjs/ui@0.62.3

## 0.62.2

### Patch Changes

- Updated dependencies [4a87635]
  - @voyantjs/availability-react@0.62.2
  - @voyantjs/bookings-react@0.62.2
  - @voyantjs/catalog@0.62.2
  - @voyantjs/catalog-react@0.62.2
  - @voyantjs/crm-react@0.62.2
  - @voyantjs/crm-ui@0.62.2
  - @voyantjs/extras-react@0.62.2
  - @voyantjs/finance-react@0.62.2
  - @voyantjs/i18n@0.62.2
  - @voyantjs/identity-react@0.62.2
  - @voyantjs/legal-react@0.62.2
  - @voyantjs/pricing-react@0.62.2
  - @voyantjs/products-react@0.62.2
  - @voyantjs/suppliers-react@0.62.2
  - @voyantjs/ui@0.62.2

## 0.62.1

### Patch Changes

- @voyantjs/availability-react@0.62.1
- @voyantjs/bookings-react@0.62.1
- @voyantjs/catalog@0.62.1
- @voyantjs/catalog-react@0.62.1
- @voyantjs/crm-react@0.62.1
- @voyantjs/crm-ui@0.62.1
- @voyantjs/extras-react@0.62.1
- @voyantjs/finance-react@0.62.1
- @voyantjs/i18n@0.62.1
- @voyantjs/identity-react@0.62.1
- @voyantjs/legal-react@0.62.1
- @voyantjs/pricing-react@0.62.1
- @voyantjs/products-react@0.62.1
- @voyantjs/suppliers-react@0.62.1
- @voyantjs/ui@0.62.1

## 0.62.0

### Patch Changes

- @voyantjs/availability-react@0.62.0
- @voyantjs/bookings-react@0.62.0
- @voyantjs/catalog@0.62.0
- @voyantjs/catalog-react@0.62.0
- @voyantjs/crm-react@0.62.0
- @voyantjs/crm-ui@0.62.0
- @voyantjs/extras-react@0.62.0
- @voyantjs/finance-react@0.62.0
- @voyantjs/i18n@0.62.0
- @voyantjs/identity-react@0.62.0
- @voyantjs/legal-react@0.62.0
- @voyantjs/pricing-react@0.62.0
- @voyantjs/products-react@0.62.0
- @voyantjs/suppliers-react@0.62.0
- @voyantjs/ui@0.62.0

## 0.61.0

### Patch Changes

- Updated dependencies [89f033e]
  - @voyantjs/availability-react@0.61.0
  - @voyantjs/bookings-react@0.61.0
  - @voyantjs/catalog@0.61.0
  - @voyantjs/catalog-react@0.61.0
  - @voyantjs/crm-react@0.61.0
  - @voyantjs/crm-ui@0.61.0
  - @voyantjs/extras-react@0.61.0
  - @voyantjs/finance-react@0.61.0
  - @voyantjs/i18n@0.61.0
  - @voyantjs/identity-react@0.61.0
  - @voyantjs/legal-react@0.61.0
  - @voyantjs/pricing-react@0.61.0
  - @voyantjs/products-react@0.61.0
  - @voyantjs/suppliers-react@0.61.0
  - @voyantjs/ui@0.61.0

## 0.60.0

### Patch Changes

- @voyantjs/availability-react@0.60.0
- @voyantjs/bookings-react@0.60.0
- @voyantjs/catalog@0.60.0
- @voyantjs/catalog-react@0.60.0
- @voyantjs/crm-react@0.60.0
- @voyantjs/crm-ui@0.60.0
- @voyantjs/extras-react@0.60.0
- @voyantjs/finance-react@0.60.0
- @voyantjs/i18n@0.60.0
- @voyantjs/identity-react@0.60.0
- @voyantjs/legal-react@0.60.0
- @voyantjs/pricing-react@0.60.0
- @voyantjs/products-react@0.60.0
- @voyantjs/suppliers-react@0.60.0
- @voyantjs/ui@0.60.0

## 0.59.0

### Patch Changes

- Updated dependencies [48927be]
  - @voyantjs/availability-react@0.59.0
  - @voyantjs/bookings-react@0.59.0
  - @voyantjs/catalog@0.59.0
  - @voyantjs/catalog-react@0.59.0
  - @voyantjs/crm-react@0.59.0
  - @voyantjs/crm-ui@0.59.0
  - @voyantjs/extras-react@0.59.0
  - @voyantjs/finance-react@0.59.0
  - @voyantjs/i18n@0.59.0
  - @voyantjs/identity-react@0.59.0
  - @voyantjs/legal-react@0.59.0
  - @voyantjs/pricing-react@0.59.0
  - @voyantjs/products-react@0.59.0
  - @voyantjs/suppliers-react@0.59.0
  - @voyantjs/ui@0.59.0

## 0.58.0

### Patch Changes

- Updated dependencies [5b21488]
  - @voyantjs/availability-react@0.58.0
  - @voyantjs/bookings-react@0.58.0
  - @voyantjs/catalog@0.58.0
  - @voyantjs/catalog-react@0.58.0
  - @voyantjs/crm-react@0.58.0
  - @voyantjs/crm-ui@0.58.0
  - @voyantjs/extras-react@0.58.0
  - @voyantjs/finance-react@0.58.0
  - @voyantjs/i18n@0.58.0
  - @voyantjs/identity-react@0.58.0
  - @voyantjs/legal-react@0.58.0
  - @voyantjs/pricing-react@0.58.0
  - @voyantjs/products-react@0.58.0
  - @voyantjs/suppliers-react@0.58.0
  - @voyantjs/ui@0.58.0

## 0.57.0

### Patch Changes

- @voyantjs/availability-react@0.57.0
- @voyantjs/bookings-react@0.57.0
- @voyantjs/catalog@0.57.0
- @voyantjs/catalog-react@0.57.0
- @voyantjs/crm-react@0.57.0
- @voyantjs/crm-ui@0.57.0
- @voyantjs/extras-react@0.57.0
- @voyantjs/finance-react@0.57.0
- @voyantjs/i18n@0.57.0
- @voyantjs/identity-react@0.57.0
- @voyantjs/legal-react@0.57.0
- @voyantjs/pricing-react@0.57.0
- @voyantjs/products-react@0.57.0
- @voyantjs/suppliers-react@0.57.0
- @voyantjs/ui@0.57.0

## 0.56.0

### Patch Changes

- @voyantjs/availability-react@0.56.0
- @voyantjs/bookings-react@0.56.0
- @voyantjs/catalog@0.56.0
- @voyantjs/catalog-react@0.56.0
- @voyantjs/crm-react@0.56.0
- @voyantjs/crm-ui@0.56.0
- @voyantjs/extras-react@0.56.0
- @voyantjs/finance-react@0.56.0
- @voyantjs/i18n@0.56.0
- @voyantjs/identity-react@0.56.0
- @voyantjs/legal-react@0.56.0
- @voyantjs/pricing-react@0.56.0
- @voyantjs/products-react@0.56.0
- @voyantjs/suppliers-react@0.56.0
- @voyantjs/ui@0.56.0

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
  - @voyantjs/availability-react@0.55.1
  - @voyantjs/bookings-react@0.55.1
  - @voyantjs/catalog@0.55.1
  - @voyantjs/catalog-react@0.55.1
  - @voyantjs/crm-react@0.55.1
  - @voyantjs/crm-ui@0.55.1
  - @voyantjs/extras-react@0.55.1
  - @voyantjs/finance-react@0.55.1
  - @voyantjs/i18n@0.55.1
  - @voyantjs/identity-react@0.55.1
  - @voyantjs/legal-react@0.55.1
  - @voyantjs/pricing-react@0.55.1
  - @voyantjs/products-react@0.55.1
  - @voyantjs/suppliers-react@0.55.1
  - @voyantjs/ui@0.55.1

## 0.55.0

### Patch Changes

- @voyantjs/availability-react@0.55.0
- @voyantjs/bookings-react@0.55.0
- @voyantjs/catalog@0.55.0
- @voyantjs/catalog-react@0.55.0
- @voyantjs/crm-react@0.55.0
- @voyantjs/crm-ui@0.55.0
- @voyantjs/finance-react@0.55.0
- @voyantjs/i18n@0.55.0
- @voyantjs/identity-react@0.55.0
- @voyantjs/legal-react@0.55.0
- @voyantjs/products-react@0.55.0
- @voyantjs/suppliers-react@0.55.0
- @voyantjs/ui@0.55.0

## 0.54.0

### Patch Changes

- Updated dependencies [3117d27]
  - @voyantjs/availability-react@0.54.0
  - @voyantjs/bookings-react@0.54.0
  - @voyantjs/catalog@0.54.0
  - @voyantjs/catalog-react@0.54.0
  - @voyantjs/crm-react@0.54.0
  - @voyantjs/crm-ui@0.54.0
  - @voyantjs/finance-react@0.54.0
  - @voyantjs/i18n@0.54.0
  - @voyantjs/identity-react@0.54.0
  - @voyantjs/legal-react@0.54.0
  - @voyantjs/products-react@0.54.0
  - @voyantjs/suppliers-react@0.54.0
  - @voyantjs/ui@0.54.0

## 0.53.2

### Patch Changes

- @voyantjs/availability-react@0.53.2
- @voyantjs/bookings-react@0.53.2
- @voyantjs/catalog@0.53.2
- @voyantjs/catalog-react@0.53.2
- @voyantjs/crm-react@0.53.2
- @voyantjs/crm-ui@0.53.2
- @voyantjs/finance-react@0.53.2
- @voyantjs/i18n@0.53.2
- @voyantjs/identity-react@0.53.2
- @voyantjs/legal-react@0.53.2
- @voyantjs/products-react@0.53.2
- @voyantjs/suppliers-react@0.53.2
- @voyantjs/ui@0.53.2

## 0.53.1

### Patch Changes

- @voyantjs/availability-react@0.53.1
- @voyantjs/bookings-react@0.53.1
- @voyantjs/catalog@0.53.1
- @voyantjs/catalog-react@0.53.1
- @voyantjs/crm-react@0.53.1
- @voyantjs/crm-ui@0.53.1
- @voyantjs/finance-react@0.53.1
- @voyantjs/i18n@0.53.1
- @voyantjs/identity-react@0.53.1
- @voyantjs/legal-react@0.53.1
- @voyantjs/products-react@0.53.1
- @voyantjs/suppliers-react@0.53.1
- @voyantjs/ui@0.53.1

## 0.53.0

### Patch Changes

- @voyantjs/availability-react@0.53.0
- @voyantjs/bookings-react@0.53.0
- @voyantjs/catalog@0.53.0
- @voyantjs/catalog-react@0.53.0
- @voyantjs/crm-react@0.53.0
- @voyantjs/crm-ui@0.53.0
- @voyantjs/finance-react@0.53.0
- @voyantjs/i18n@0.53.0
- @voyantjs/identity-react@0.53.0
- @voyantjs/legal-react@0.53.0
- @voyantjs/products-react@0.53.0
- @voyantjs/suppliers-react@0.53.0
- @voyantjs/ui@0.53.0

## 0.52.4

### Patch Changes

- 5d3c119: Fix multi-option booking on option-scoped slots (issue #960). UI + server land together — neither half works on its own.

  **UI (`@voyantjs/bookings-ui`)** — `OptionUnitsStepperSection` used to swap between data sources: when the slot's `option_id` was set, only that option's units showed, hiding every other option the product offered. A tour selling SGL/DBL/TWN/TPL on the same departure with `slot.option_id = popt_SGL` showed only "SGL · 2 left" next to a "Jun 18 · 45 left" departure badge; selling DBL required nulling out the slot's `option_id` in the DB.

  The new behaviour merges the two sources: slot-bound `useSlotUnitAvailability` rows stay authoritative for the slot's own option (real-time `remaining` from active bookings), and product-level `option_units` fill in every other option the product offers. Product-level slots (`option_id = NULL`) and unloaded slot data fall back to product-level rows for everything. Exports `mergeStepperUnits` + `resolveSlotOptionId` as pure helpers.

  **Server (`@voyantjs/bookings`)** — relaxed two hard guards that previously rejected multi-option booking on option-scoped slots:

  - `getConvertProductData` dropped the "every requested line option must equal `selectedSlot.optionId`" reject. Each line's `optionId` is still validated to live on the product; the explicit caller-passed `data.optionId` mismatch reject stays.
  - `convertProductToBooking` dropped the per-item `slot_option_mismatch` throw. The product mismatch throw stays (an item's `productId` still has to match the slot's product).

  Slot pax capacity is still enforced server-side by `adjustSlotCapacity` — the wider stepper can't oversell the departure. Per-option-unit oversell of the non-slot-tracked options matches the existing behaviour for product-level slots and is called out in the existing capacity comment.

  `reserveBooking` (offer-conversion path) keeps its `slot_option_mismatch` guard untouched — that flow is out of scope for this fix.

- Updated dependencies [5d3c119]
  - @voyantjs/availability-react@0.52.4
  - @voyantjs/bookings-react@0.52.4
  - @voyantjs/catalog@0.52.4
  - @voyantjs/catalog-react@0.52.4
  - @voyantjs/crm-react@0.52.4
  - @voyantjs/crm-ui@0.52.4
  - @voyantjs/finance-react@0.52.4
  - @voyantjs/i18n@0.52.4
  - @voyantjs/identity-react@0.52.4
  - @voyantjs/legal-react@0.52.4
  - @voyantjs/products-react@0.52.4
  - @voyantjs/suppliers-react@0.52.4
  - @voyantjs/ui@0.52.4

## 0.52.3

### Patch Changes

- 9679a57: Allow BookingWorkspacePage consumers to replace the default booking tab content with a typed bookingTab slot.
- Updated dependencies [9679a57]
  - @voyantjs/availability-react@0.52.3
  - @voyantjs/bookings-react@0.52.3
  - @voyantjs/catalog@0.52.3
  - @voyantjs/catalog-react@0.52.3
  - @voyantjs/crm-react@0.52.3
  - @voyantjs/crm-ui@0.52.3
  - @voyantjs/finance-react@0.52.3
  - @voyantjs/i18n@0.52.3
  - @voyantjs/identity-react@0.52.3
  - @voyantjs/legal-react@0.52.3
  - @voyantjs/products-react@0.52.3
  - @voyantjs/suppliers-react@0.52.3
  - @voyantjs/ui@0.52.3

## 0.52.2

### Patch Changes

- 3e09123: Booking create + detail flow overhaul.

  - Rename `RoomsStepperSection` → `OptionUnitsStepperSection` across `@voyantjs/bookings-ui` and the `@voyantjs/ui` registry. The old name implied hospitality-only usage; the same stepper now drives any product option (rooms, cabins, vehicles, seats). Re-export kept under the new name only — consumers must update imports.
  - Rebuild `BookingCreateDialog` around the new option-units stepper, person picker, travelers section, and price-breakdown card so room/cabin/seat selection, traveler capture, and price preview share state correctly. Travelers section gains contact-points support and consistent validation messages.
  - New `BookingBillingDialog` for editing the billing person/organization + billing address on an existing booking.
  - New `useBookingTaxPreview` hook + `booking.taxPreview` query option for previewing tax breakdowns on draft bookings before issuing an invoice. Exposes a new `bookingTaxPreviewSchema` from `@voyantjs/bookings-react/schemas`.
  - `useBookingCreateMutation`, `useBookingMutation`, and `useBookingStatusMutation` invalidate the new tax-preview and finance keys so price/invoice cards stay in sync after status transitions.
  - `@voyantjs/bookings` service: extend `validation` with the billing-update schema, wire `status-dispatch` to the new finance.issue payload, and add a tax-preview entrypoint consumed by the operator template.
  - i18n: new `bookings-ui` and `i18n/admin/bookings` strings for the billing dialog, tax preview, option-units copy, and status-change confirmations (EN + RO).

- Updated dependencies [3e09123]
- Updated dependencies [3e09123]
- Updated dependencies [3e09123]
- Updated dependencies [3e09123]
- Updated dependencies [3e09123]
- Updated dependencies [6bdfcbc]
- Updated dependencies [3e09123]
  - @voyantjs/availability-react@0.52.2
  - @voyantjs/bookings-react@0.52.2
  - @voyantjs/catalog@0.52.2
  - @voyantjs/catalog-react@0.52.2
  - @voyantjs/crm-react@0.52.2
  - @voyantjs/crm-ui@0.52.2
  - @voyantjs/finance-react@0.52.2
  - @voyantjs/i18n@0.52.2
  - @voyantjs/identity-react@0.52.2
  - @voyantjs/legal-react@0.52.2
  - @voyantjs/products-react@0.52.2
  - @voyantjs/suppliers-react@0.52.2
  - @voyantjs/ui@0.52.2

## 0.52.1

### Patch Changes

- @voyantjs/availability-react@0.52.1
- @voyantjs/bookings-react@0.52.1
- @voyantjs/catalog@0.52.1
- @voyantjs/catalog-react@0.52.1
- @voyantjs/crm-react@0.52.1
- @voyantjs/crm-ui@0.52.1
- @voyantjs/finance-react@0.52.1
- @voyantjs/i18n@0.52.1
- @voyantjs/legal-react@0.52.1
- @voyantjs/products-react@0.52.1
- @voyantjs/suppliers-react@0.52.1
- @voyantjs/ui@0.52.1

## 0.52.0

### Patch Changes

- @voyantjs/availability-react@0.52.0
- @voyantjs/bookings-react@0.52.0
- @voyantjs/catalog@0.52.0
- @voyantjs/catalog-react@0.52.0
- @voyantjs/crm-react@0.52.0
- @voyantjs/crm-ui@0.52.0
- @voyantjs/finance-react@0.52.0
- @voyantjs/i18n@0.52.0
- @voyantjs/legal-react@0.52.0
- @voyantjs/products-react@0.52.0
- @voyantjs/suppliers-react@0.52.0
- @voyantjs/ui@0.52.0

## 0.51.1

### Patch Changes

- Updated dependencies [deaacb3]
  - @voyantjs/availability-react@0.51.1
  - @voyantjs/bookings-react@0.51.1
  - @voyantjs/catalog@0.51.1
  - @voyantjs/catalog-react@0.51.1
  - @voyantjs/crm-react@0.51.1
  - @voyantjs/crm-ui@0.51.1
  - @voyantjs/finance-react@0.51.1
  - @voyantjs/i18n@0.51.1
  - @voyantjs/legal-react@0.51.1
  - @voyantjs/products-react@0.51.1
  - @voyantjs/suppliers-react@0.51.1
  - @voyantjs/ui@0.51.1

## 0.51.0

### Patch Changes

- Updated dependencies [2316791]
  - @voyantjs/availability-react@0.51.0
  - @voyantjs/bookings-react@0.51.0
  - @voyantjs/catalog@0.51.0
  - @voyantjs/catalog-react@0.51.0
  - @voyantjs/crm-react@0.51.0
  - @voyantjs/crm-ui@0.51.0
  - @voyantjs/finance-react@0.51.0
  - @voyantjs/i18n@0.51.0
  - @voyantjs/legal-react@0.51.0
  - @voyantjs/products-react@0.51.0
  - @voyantjs/suppliers-react@0.51.0
  - @voyantjs/ui@0.51.0

## 0.50.8

### Patch Changes

- f35014f: Fix admin booking create pricing and room-option selection after the initial create-flow patch. The admin flow now resolves active internal products for pricing preview, keeps selected combobox labels readable, lists product options as independent room/unit rows, and shows accurate pricing-preview fallback copy.
  - @voyantjs/availability-react@0.50.8
  - @voyantjs/bookings-react@0.50.8
  - @voyantjs/catalog@0.50.8
  - @voyantjs/catalog-react@0.50.8
  - @voyantjs/crm-react@0.50.8
  - @voyantjs/crm-ui@0.50.8
  - @voyantjs/finance-react@0.50.8
  - @voyantjs/i18n@0.50.8
  - @voyantjs/legal-react@0.50.8
  - @voyantjs/products-react@0.50.8
  - @voyantjs/suppliers-react@0.50.8
  - @voyantjs/ui@0.50.8

## 0.50.7

### Patch Changes

- 7e4593e: Make the booking create flow usable for priced room/unit selections by keeping product combobox labels readable, falling back to product departures when option-filtered departures are empty, showing option units before departure selection, and surfacing booking total/scheduled/remaining payment amounts.
  - @voyantjs/availability-react@0.50.7
  - @voyantjs/bookings-react@0.50.7
  - @voyantjs/catalog@0.50.7
  - @voyantjs/catalog-react@0.50.7
  - @voyantjs/crm-react@0.50.7
  - @voyantjs/crm-ui@0.50.7
  - @voyantjs/finance-react@0.50.7
  - @voyantjs/i18n@0.50.7
  - @voyantjs/legal-react@0.50.7
  - @voyantjs/products-react@0.50.7
  - @voyantjs/suppliers-react@0.50.7
  - @voyantjs/ui@0.50.7

## 0.50.6

### Patch Changes

- c14f0a8: Fix the booking-create flow: scrollable dialog content with reachable actions, normalized product search, future departure lookup, shared-room clearing, explicit item lines, selectable traveler people including the payer, already-paid schedule rows, and booking-create naming throughout the API/registry surface.
- Updated dependencies [c14f0a8]
  - @voyantjs/availability-react@0.50.6
  - @voyantjs/bookings-react@0.50.6
  - @voyantjs/catalog@0.50.6
  - @voyantjs/catalog-react@0.50.6
  - @voyantjs/crm-react@0.50.6
  - @voyantjs/crm-ui@0.50.6
  - @voyantjs/finance-react@0.50.6
  - @voyantjs/i18n@0.50.6
  - @voyantjs/legal-react@0.50.6
  - @voyantjs/products-react@0.50.6
  - @voyantjs/suppliers-react@0.50.6
  - @voyantjs/ui@0.50.6

## 0.50.5

### Patch Changes

- @voyantjs/availability-react@0.50.5
- @voyantjs/bookings-react@0.50.5
- @voyantjs/catalog@0.50.5
- @voyantjs/catalog-react@0.50.5
- @voyantjs/crm-react@0.50.5
- @voyantjs/crm-ui@0.50.5
- @voyantjs/finance-react@0.50.5
- @voyantjs/i18n@0.50.5
- @voyantjs/legal-react@0.50.5
- @voyantjs/products-react@0.50.5
- @voyantjs/suppliers-react@0.50.5
- @voyantjs/ui@0.50.5

## 0.50.4

### Patch Changes

- @voyantjs/availability-react@0.50.4
- @voyantjs/bookings-react@0.50.4
- @voyantjs/catalog@0.50.4
- @voyantjs/catalog-react@0.50.4
- @voyantjs/crm-react@0.50.4
- @voyantjs/crm-ui@0.50.4
- @voyantjs/finance-react@0.50.4
- @voyantjs/i18n@0.50.4
- @voyantjs/legal-react@0.50.4
- @voyantjs/products-react@0.50.4
- @voyantjs/suppliers-react@0.50.4
- @voyantjs/ui@0.50.4

## 0.50.3

### Patch Changes

- f6e051e: Allow BookingWorkspacePage consumers to replace the default booking tab content with a typed bookingTab slot.
  - @voyantjs/availability-react@0.50.3
  - @voyantjs/bookings-react@0.50.3
  - @voyantjs/catalog@0.50.3
  - @voyantjs/catalog-react@0.50.3
  - @voyantjs/crm-react@0.50.3
  - @voyantjs/crm-ui@0.50.3
  - @voyantjs/finance-react@0.50.3
  - @voyantjs/i18n@0.50.3
  - @voyantjs/legal-react@0.50.3
  - @voyantjs/products-react@0.50.3
  - @voyantjs/suppliers-react@0.50.3
  - @voyantjs/ui@0.50.3

## 0.50.2

### Patch Changes

- @voyantjs/availability-react@0.50.2
- @voyantjs/bookings-react@0.50.2
- @voyantjs/catalog@0.50.2
- @voyantjs/catalog-react@0.50.2
- @voyantjs/crm-react@0.50.2
- @voyantjs/crm-ui@0.50.2
- @voyantjs/finance-react@0.50.2
- @voyantjs/i18n@0.50.2
- @voyantjs/legal-react@0.50.2
- @voyantjs/products-react@0.50.2
- @voyantjs/suppliers-react@0.50.2
- @voyantjs/ui@0.50.2

## 0.50.1

### Patch Changes

- @voyantjs/availability-react@0.50.1
- @voyantjs/bookings-react@0.50.1
- @voyantjs/catalog@0.50.1
- @voyantjs/catalog-react@0.50.1
- @voyantjs/crm-react@0.50.1
- @voyantjs/crm-ui@0.50.1
- @voyantjs/finance-react@0.50.1
- @voyantjs/i18n@0.50.1
- @voyantjs/legal-react@0.50.1
- @voyantjs/products-react@0.50.1
- @voyantjs/suppliers-react@0.50.1
- @voyantjs/ui@0.50.1

## 0.50.0

### Patch Changes

- Updated dependencies [140d0ad]
  - @voyantjs/availability-react@0.50.0
  - @voyantjs/bookings-react@0.50.0
  - @voyantjs/catalog@0.50.0
  - @voyantjs/catalog-react@0.50.0
  - @voyantjs/crm-react@0.50.0
  - @voyantjs/crm-ui@0.50.0
  - @voyantjs/finance-react@0.50.0
  - @voyantjs/i18n@0.50.0
  - @voyantjs/legal-react@0.50.0
  - @voyantjs/products-react@0.50.0
  - @voyantjs/suppliers-react@0.50.0
  - @voyantjs/ui@0.50.0

## 0.49.0

### Patch Changes

- @voyantjs/availability-react@0.49.0
- @voyantjs/bookings-react@0.49.0
- @voyantjs/catalog@0.49.0
- @voyantjs/catalog-react@0.49.0
- @voyantjs/crm-react@0.49.0
- @voyantjs/crm-ui@0.49.0
- @voyantjs/finance-react@0.49.0
- @voyantjs/i18n@0.49.0
- @voyantjs/legal-react@0.49.0
- @voyantjs/products-react@0.49.0
- @voyantjs/suppliers-react@0.49.0
- @voyantjs/ui@0.49.0

## 0.48.0

### Patch Changes

- @voyantjs/availability-react@0.48.0
- @voyantjs/bookings-react@0.48.0
- @voyantjs/catalog@0.48.0
- @voyantjs/catalog-react@0.48.0
- @voyantjs/crm-react@0.48.0
- @voyantjs/crm-ui@0.48.0
- @voyantjs/finance-react@0.48.0
- @voyantjs/i18n@0.48.0
- @voyantjs/legal-react@0.48.0
- @voyantjs/products-react@0.48.0
- @voyantjs/suppliers-react@0.48.0
- @voyantjs/ui@0.48.0

## 0.47.0

### Patch Changes

- @voyantjs/availability-react@0.47.0
- @voyantjs/bookings-react@0.47.0
- @voyantjs/catalog@0.47.0
- @voyantjs/catalog-react@0.47.0
- @voyantjs/crm-react@0.47.0
- @voyantjs/crm-ui@0.47.0
- @voyantjs/finance-react@0.47.0
- @voyantjs/i18n@0.47.0
- @voyantjs/legal-react@0.47.0
- @voyantjs/products-react@0.47.0
- @voyantjs/suppliers-react@0.47.0
- @voyantjs/ui@0.47.0

## 0.46.0

### Patch Changes

- Updated dependencies [72b99b2]
  - @voyantjs/availability-react@0.46.0
  - @voyantjs/bookings-react@0.46.0
  - @voyantjs/catalog@0.46.0
  - @voyantjs/catalog-react@0.46.0
  - @voyantjs/crm-react@0.46.0
  - @voyantjs/crm-ui@0.46.0
  - @voyantjs/finance-react@0.46.0
  - @voyantjs/i18n@0.46.0
  - @voyantjs/legal-react@0.46.0
  - @voyantjs/products-react@0.46.0
  - @voyantjs/suppliers-react@0.46.0
  - @voyantjs/ui@0.46.0

## 0.45.0

### Patch Changes

- @voyantjs/availability-react@0.45.0
- @voyantjs/bookings-react@0.45.0
- @voyantjs/catalog@0.45.0
- @voyantjs/catalog-react@0.45.0
- @voyantjs/crm-react@0.45.0
- @voyantjs/crm-ui@0.45.0
- @voyantjs/finance-react@0.45.0
- @voyantjs/i18n@0.45.0
- @voyantjs/legal-react@0.45.0
- @voyantjs/products-react@0.45.0
- @voyantjs/suppliers-react@0.45.0
- @voyantjs/ui@0.45.0

## 0.44.0

### Minor Changes

- 2bc4a60: Add `BookingWorkspacePage`, a reusable operator workspace shell that mounts `BookingDetailPage` with cross-module navigation, typed slots, sidebars, and bulk-action context.

### Patch Changes

- @voyantjs/availability-react@0.44.0
- @voyantjs/bookings-react@0.44.0
- @voyantjs/catalog@0.44.0
- @voyantjs/catalog-react@0.44.0
- @voyantjs/crm-react@0.44.0
- @voyantjs/crm-ui@0.44.0
- @voyantjs/finance-react@0.44.0
- @voyantjs/i18n@0.44.0
- @voyantjs/legal-react@0.44.0
- @voyantjs/products-react@0.44.0
- @voyantjs/suppliers-react@0.44.0
- @voyantjs/ui@0.44.0

## 0.43.0

### Patch Changes

- @voyantjs/availability-react@0.43.0
- @voyantjs/bookings-react@0.43.0
- @voyantjs/catalog@0.43.0
- @voyantjs/catalog-react@0.43.0
- @voyantjs/crm-react@0.43.0
- @voyantjs/crm-ui@0.43.0
- @voyantjs/finance-react@0.43.0
- @voyantjs/i18n@0.43.0
- @voyantjs/legal-react@0.43.0
- @voyantjs/products-react@0.43.0
- @voyantjs/suppliers-react@0.43.0
- @voyantjs/ui@0.43.0

## 0.42.0

### Patch Changes

- @voyantjs/availability-react@0.42.0
- @voyantjs/bookings-react@0.42.0
- @voyantjs/catalog@0.42.0
- @voyantjs/catalog-react@0.42.0
- @voyantjs/crm-react@0.42.0
- @voyantjs/crm-ui@0.42.0
- @voyantjs/finance-react@0.42.0
- @voyantjs/i18n@0.42.0
- @voyantjs/legal-react@0.42.0
- @voyantjs/products-react@0.42.0
- @voyantjs/suppliers-react@0.42.0
- @voyantjs/ui@0.42.0

## 0.41.3

### Patch Changes

- @voyantjs/availability-react@0.41.3
- @voyantjs/bookings-react@0.41.3
- @voyantjs/catalog@0.41.3
- @voyantjs/catalog-react@0.41.3
- @voyantjs/crm-react@0.41.3
- @voyantjs/crm-ui@0.41.3
- @voyantjs/finance-react@0.41.3
- @voyantjs/i18n@0.41.3
- @voyantjs/legal-react@0.41.3
- @voyantjs/products-react@0.41.3
- @voyantjs/suppliers-react@0.41.3
- @voyantjs/ui@0.41.3

## 0.41.2

### Patch Changes

- @voyantjs/availability-react@0.41.2
- @voyantjs/bookings-react@0.41.2
- @voyantjs/catalog@0.41.2
- @voyantjs/catalog-react@0.41.2
- @voyantjs/crm-react@0.41.2
- @voyantjs/crm-ui@0.41.2
- @voyantjs/finance-react@0.41.2
- @voyantjs/i18n@0.41.2
- @voyantjs/legal-react@0.41.2
- @voyantjs/products-react@0.41.2
- @voyantjs/suppliers-react@0.41.2
- @voyantjs/ui@0.41.2

## 0.41.1

### Patch Changes

- @voyantjs/availability-react@0.41.1
- @voyantjs/bookings-react@0.41.1
- @voyantjs/catalog@0.41.1
- @voyantjs/catalog-react@0.41.1
- @voyantjs/crm-react@0.41.1
- @voyantjs/crm-ui@0.41.1
- @voyantjs/finance-react@0.41.1
- @voyantjs/i18n@0.41.1
- @voyantjs/legal-react@0.41.1
- @voyantjs/products-react@0.41.1
- @voyantjs/suppliers-react@0.41.1
- @voyantjs/ui@0.41.1

## 0.41.0

### Patch Changes

- @voyantjs/availability-react@0.41.0
- @voyantjs/bookings-react@0.41.0
- @voyantjs/catalog@0.41.0
- @voyantjs/catalog-react@0.41.0
- @voyantjs/crm-react@0.41.0
- @voyantjs/crm-ui@0.41.0
- @voyantjs/finance-react@0.41.0
- @voyantjs/i18n@0.41.0
- @voyantjs/legal-react@0.41.0
- @voyantjs/products-react@0.41.0
- @voyantjs/suppliers-react@0.41.0
- @voyantjs/ui@0.41.0

## 0.40.1

### Patch Changes

- @voyantjs/availability-react@0.40.1
- @voyantjs/bookings-react@0.40.1
- @voyantjs/catalog@0.40.1
- @voyantjs/catalog-react@0.40.1
- @voyantjs/crm-react@0.40.1
- @voyantjs/crm-ui@0.40.1
- @voyantjs/finance-react@0.40.1
- @voyantjs/i18n@0.40.1
- @voyantjs/legal-react@0.40.1
- @voyantjs/products-react@0.40.1
- @voyantjs/suppliers-react@0.40.1
- @voyantjs/ui@0.40.1

## 0.40.0

### Patch Changes

- @voyantjs/availability-react@0.40.0
- @voyantjs/bookings-react@0.40.0
- @voyantjs/catalog@0.40.0
- @voyantjs/catalog-react@0.40.0
- @voyantjs/crm-react@0.40.0
- @voyantjs/crm-ui@0.40.0
- @voyantjs/finance-react@0.40.0
- @voyantjs/i18n@0.40.0
- @voyantjs/legal-react@0.40.0
- @voyantjs/products-react@0.40.0
- @voyantjs/suppliers-react@0.40.0
- @voyantjs/ui@0.40.0

## 0.39.0

### Minor Changes

- f4235ea: Finish the bookings passenger-to-traveler rename across the React/UI layer and shadcn registry.

  `@voyantjs/bookings-ui` now exposes `TravelersSection` and traveler-first section value/types. `@voyantjs/bookings-react` uses traveler hooks/query helpers over the traveler endpoints. The bookings activity enum now emits `traveler_update`; dev/operator/DMC migrations rename existing `passenger_update` activity rows.

  The shadcn registry now publishes `voyant-bookings-travelers-section` and removes the stale passenger dialog/list/section registry artifacts.

### Patch Changes

- Updated dependencies [f4235ea]
- Updated dependencies [f01fc0f]
  - @voyantjs/availability-react@0.39.0
  - @voyantjs/bookings-react@0.39.0
  - @voyantjs/catalog@0.39.0
  - @voyantjs/catalog-react@0.39.0
  - @voyantjs/crm-react@0.39.0
  - @voyantjs/crm-ui@0.39.0
  - @voyantjs/finance-react@0.39.0
  - @voyantjs/i18n@0.39.0
  - @voyantjs/legal-react@0.39.0
  - @voyantjs/products-react@0.39.0
  - @voyantjs/suppliers-react@0.39.0
  - @voyantjs/ui@0.39.0

## 0.38.2

### Patch Changes

- @voyantjs/availability-react@0.38.2
- @voyantjs/bookings-react@0.38.2
- @voyantjs/catalog@0.38.2
- @voyantjs/catalog-react@0.38.2
- @voyantjs/crm-react@0.38.2
- @voyantjs/crm-ui@0.38.2
- @voyantjs/finance-react@0.38.2
- @voyantjs/i18n@0.38.2
- @voyantjs/legal-react@0.38.2
- @voyantjs/products-react@0.38.2
- @voyantjs/suppliers-react@0.38.2
- @voyantjs/ui@0.38.2

## 0.38.1

### Patch Changes

- @voyantjs/availability-react@0.38.1
- @voyantjs/bookings-react@0.38.1
- @voyantjs/catalog@0.38.1
- @voyantjs/catalog-react@0.38.1
- @voyantjs/crm-react@0.38.1
- @voyantjs/crm-ui@0.38.1
- @voyantjs/finance-react@0.38.1
- @voyantjs/i18n@0.38.1
- @voyantjs/legal-react@0.38.1
- @voyantjs/products-react@0.38.1
- @voyantjs/suppliers-react@0.38.1
- @voyantjs/ui@0.38.1

## 0.38.0

### Patch Changes

- @voyantjs/availability-react@0.38.0
- @voyantjs/bookings-react@0.38.0
- @voyantjs/catalog@0.38.0
- @voyantjs/catalog-react@0.38.0
- @voyantjs/crm-react@0.38.0
- @voyantjs/crm-ui@0.38.0
- @voyantjs/finance-react@0.38.0
- @voyantjs/i18n@0.38.0
- @voyantjs/legal-react@0.38.0
- @voyantjs/products-react@0.38.0
- @voyantjs/suppliers-react@0.38.0
- @voyantjs/ui@0.38.0

## 0.37.1

### Patch Changes

- @voyantjs/availability-react@0.37.1
- @voyantjs/bookings-react@0.37.1
- @voyantjs/catalog@0.37.1
- @voyantjs/catalog-react@0.37.1
- @voyantjs/crm-react@0.37.1
- @voyantjs/crm-ui@0.37.1
- @voyantjs/finance-react@0.37.1
- @voyantjs/i18n@0.37.1
- @voyantjs/legal-react@0.37.1
- @voyantjs/products-react@0.37.1
- @voyantjs/suppliers-react@0.37.1
- @voyantjs/ui@0.37.1

## 0.37.0

### Minor Changes

- eef2df0: Add a route-friendly booking create page and upgrade booking creation pickers with async product, person, organization, and shared-room controls.
- 4c93561: Add supplier, product category, option, person, and organization filters to the bookings list API and UI.
- dc29b79: Persist operator-confirmed booking totals from the create dialog and audit manual price overrides with a required reason.
- 02287bf: Add a reusable booking combobox and use it in finance dialogs instead of raw booking ID inputs.

### Patch Changes

- 0c9b884: Route remaining reusable UI literals through package i18n providers and add the UI literal scan to the shared i18n CI check.
- e5ce6a0: Route remaining shared UI literals through package i18n providers.
- Updated dependencies [4c93561]
- Updated dependencies [dc29b79]
- Updated dependencies [c71df12]
- Updated dependencies [0689fcb]
- Updated dependencies [a48660e]
- Updated dependencies [f014fd2]
- Updated dependencies [0c9b884]
  - @voyantjs/availability-react@0.37.0
  - @voyantjs/bookings-react@0.37.0
  - @voyantjs/catalog@0.37.0
  - @voyantjs/catalog-react@0.37.0
  - @voyantjs/crm-react@0.37.0
  - @voyantjs/crm-ui@0.37.0
  - @voyantjs/finance-react@0.37.0
  - @voyantjs/i18n@0.37.0
  - @voyantjs/legal-react@0.37.0
  - @voyantjs/products-react@0.37.0
  - @voyantjs/suppliers-react@0.37.0
  - @voyantjs/ui@0.37.0

## 0.36.0

### Patch Changes

- Updated dependencies [15e6953]
  - @voyantjs/availability-react@0.36.0
  - @voyantjs/bookings-react@0.36.0
  - @voyantjs/catalog@0.36.0
  - @voyantjs/catalog-react@0.36.0
  - @voyantjs/crm-react@0.36.0
  - @voyantjs/finance-react@0.36.0
  - @voyantjs/i18n@0.36.0
  - @voyantjs/legal-react@0.36.0
  - @voyantjs/products-react@0.36.0
  - @voyantjs/ui@0.36.0

## 0.35.0

### Patch Changes

- Updated dependencies [baa6134]
  - @voyantjs/availability-react@0.35.0
  - @voyantjs/bookings-react@0.35.0
  - @voyantjs/catalog@0.35.0
  - @voyantjs/catalog-react@0.35.0
  - @voyantjs/crm-react@0.35.0
  - @voyantjs/finance-react@0.35.0
  - @voyantjs/i18n@0.35.0
  - @voyantjs/legal-react@0.35.0
  - @voyantjs/products-react@0.35.0
  - @voyantjs/ui@0.35.0

## 0.34.0

### Patch Changes

- 70ee277: Add a shared CurrencyInput and use it for editable operator money fields so forms display decimal amounts with the currency symbol and code while still submitting minor units.
- f2d4802: Replace native date and datetime inputs with shared DatePicker and DateTimePicker controls.
- 1c3f635: Give shipped page components default outer padding and document the page mounting contract.
- Updated dependencies [6ad175a]
- Updated dependencies [6e4a90f]
- Updated dependencies [24b6624]
- Updated dependencies [70ee277]
- Updated dependencies [f2d4802]
  - @voyantjs/availability-react@0.34.0
  - @voyantjs/bookings-react@0.34.0
  - @voyantjs/catalog@0.34.0
  - @voyantjs/catalog-react@0.34.0
  - @voyantjs/crm-react@0.34.0
  - @voyantjs/finance-react@0.34.0
  - @voyantjs/i18n@0.34.0
  - @voyantjs/legal-react@0.34.0
  - @voyantjs/products-react@0.34.0
  - @voyantjs/ui@0.34.0

## 0.33.1

### Patch Changes

- 9bee9aa: Hydrate booking list item summaries with product names and prefer those names in the Bookings list "What booked" column.
- Updated dependencies [9bee9aa]
  - @voyantjs/availability-react@0.33.1
  - @voyantjs/bookings-react@0.33.1
  - @voyantjs/catalog@0.33.1
  - @voyantjs/catalog-react@0.33.1
  - @voyantjs/crm-react@0.33.1
  - @voyantjs/finance-react@0.33.1
  - @voyantjs/i18n@0.33.1
  - @voyantjs/legal-react@0.33.1
  - @voyantjs/products-react@0.33.1
  - @voyantjs/ui@0.33.1

## 0.33.0

### Patch Changes

- Updated dependencies [db46afc]
  - @voyantjs/availability-react@0.33.0
  - @voyantjs/bookings-react@0.33.0
  - @voyantjs/catalog@0.33.0
  - @voyantjs/catalog-react@0.33.0
  - @voyantjs/crm-react@0.33.0
  - @voyantjs/finance-react@0.33.0
  - @voyantjs/i18n@0.33.0
  - @voyantjs/legal-react@0.33.0
  - @voyantjs/products-react@0.33.0
  - @voyantjs/ui@0.33.0

## 0.32.3

### Patch Changes

- Updated dependencies [7632a66]
  - @voyantjs/availability-react@0.32.3
  - @voyantjs/bookings-react@0.32.3
  - @voyantjs/catalog@0.32.3
  - @voyantjs/catalog-react@0.32.3
  - @voyantjs/crm-react@0.32.3
  - @voyantjs/finance-react@0.32.3
  - @voyantjs/i18n@0.32.3
  - @voyantjs/legal-react@0.32.3
  - @voyantjs/products-react@0.32.3
  - @voyantjs/ui@0.32.3

## 0.32.2

### Patch Changes

- @voyantjs/availability-react@0.32.2
- @voyantjs/bookings-react@0.32.2
- @voyantjs/catalog@0.32.2
- @voyantjs/catalog-react@0.32.2
- @voyantjs/crm-react@0.32.2
- @voyantjs/finance-react@0.32.2
- @voyantjs/i18n@0.32.2
- @voyantjs/legal-react@0.32.2
- @voyantjs/products-react@0.32.2
- @voyantjs/ui@0.32.2

## 0.32.1

### Patch Changes

- @voyantjs/availability-react@0.32.1
- @voyantjs/bookings-react@0.32.1
- @voyantjs/catalog@0.32.1
- @voyantjs/catalog-react@0.32.1
- @voyantjs/crm-react@0.32.1
- @voyantjs/finance-react@0.32.1
- @voyantjs/i18n@0.32.1
- @voyantjs/legal-react@0.32.1
- @voyantjs/products-react@0.32.1
- @voyantjs/ui@0.32.1

## 0.32.0

### Patch Changes

- @voyantjs/availability-react@0.32.0
- @voyantjs/bookings-react@0.32.0
- @voyantjs/catalog@0.32.0
- @voyantjs/catalog-react@0.32.0
- @voyantjs/crm-react@0.32.0
- @voyantjs/finance-react@0.32.0
- @voyantjs/i18n@0.32.0
- @voyantjs/legal-react@0.32.0
- @voyantjs/products-react@0.32.0
- @voyantjs/ui@0.32.0

## 0.31.4

### Patch Changes

- @voyantjs/availability-react@0.31.4
- @voyantjs/bookings-react@0.31.4
- @voyantjs/catalog@0.31.4
- @voyantjs/catalog-react@0.31.4
- @voyantjs/crm-react@0.31.4
- @voyantjs/finance-react@0.31.4
- @voyantjs/i18n@0.31.4
- @voyantjs/legal-react@0.31.4
- @voyantjs/products-react@0.31.4
- @voyantjs/ui@0.31.4

## 0.31.3

### Patch Changes

- Updated dependencies [5f974dd]
  - @voyantjs/availability-react@0.31.3
  - @voyantjs/bookings-react@0.31.3
  - @voyantjs/catalog@0.31.3
  - @voyantjs/catalog-react@0.31.3
  - @voyantjs/crm-react@0.31.3
  - @voyantjs/finance-react@0.31.3
  - @voyantjs/i18n@0.31.3
  - @voyantjs/legal-react@0.31.3
  - @voyantjs/products-react@0.31.3
  - @voyantjs/ui@0.31.3

## 0.31.2

### Patch Changes

- Updated dependencies [54ddc93]
  - @voyantjs/availability-react@0.31.2
  - @voyantjs/bookings-react@0.31.2
  - @voyantjs/catalog@0.31.2
  - @voyantjs/catalog-react@0.31.2
  - @voyantjs/crm-react@0.31.2
  - @voyantjs/finance-react@0.31.2
  - @voyantjs/i18n@0.31.2
  - @voyantjs/legal-react@0.31.2
  - @voyantjs/products-react@0.31.2
  - @voyantjs/ui@0.31.2

## 0.31.1

### Patch Changes

- Updated dependencies [00f7c4f]
  - @voyantjs/availability-react@0.31.1
  - @voyantjs/bookings-react@0.31.1
  - @voyantjs/catalog@0.31.1
  - @voyantjs/catalog-react@0.31.1
  - @voyantjs/crm-react@0.31.1
  - @voyantjs/finance-react@0.31.1
  - @voyantjs/i18n@0.31.1
  - @voyantjs/legal-react@0.31.1
  - @voyantjs/products-react@0.31.1
  - @voyantjs/ui@0.31.1

## 0.31.0

### Minor Changes

- ee75afb: Publish reusable list page compositions for bookings, product categories, product tags, and pricing categories.

### Patch Changes

- ee75afb: Publish the booking detail page composition with router callbacks and detail slots.
  - @voyantjs/availability-react@0.31.0
  - @voyantjs/bookings-react@0.31.0
  - @voyantjs/catalog@0.31.0
  - @voyantjs/catalog-react@0.31.0
  - @voyantjs/crm-react@0.31.0
  - @voyantjs/finance-react@0.31.0
  - @voyantjs/i18n@0.31.0
  - @voyantjs/legal-react@0.31.0
  - @voyantjs/products-react@0.31.0
  - @voyantjs/ui@0.31.0

## 0.30.7

### Patch Changes

- @voyantjs/availability-react@0.30.7
- @voyantjs/bookings-react@0.30.7
- @voyantjs/catalog@0.30.7
- @voyantjs/catalog-react@0.30.7
- @voyantjs/crm-react@0.30.7
- @voyantjs/finance-react@0.30.7
- @voyantjs/i18n@0.30.7
- @voyantjs/legal-react@0.30.7
- @voyantjs/products-react@0.30.7
- @voyantjs/ui@0.30.7

## 0.30.6

### Patch Changes

- @voyantjs/availability-react@0.30.6
- @voyantjs/bookings-react@0.30.6
- @voyantjs/catalog@0.30.6
- @voyantjs/catalog-react@0.30.6
- @voyantjs/crm-react@0.30.6
- @voyantjs/finance-react@0.30.6
- @voyantjs/i18n@0.30.6
- @voyantjs/legal-react@0.30.6
- @voyantjs/products-react@0.30.6
- @voyantjs/ui@0.30.6

## 0.30.5

### Patch Changes

- @voyantjs/availability-react@0.30.5
- @voyantjs/bookings-react@0.30.5
- @voyantjs/catalog@0.30.5
- @voyantjs/catalog-react@0.30.5
- @voyantjs/crm-react@0.30.5
- @voyantjs/finance-react@0.30.5
- @voyantjs/i18n@0.30.5
- @voyantjs/legal-react@0.30.5
- @voyantjs/products-react@0.30.5
- @voyantjs/ui@0.30.5

## 0.30.4

### Patch Changes

- @voyantjs/availability-react@0.30.4
- @voyantjs/bookings-react@0.30.4
- @voyantjs/catalog@0.30.4
- @voyantjs/catalog-react@0.30.4
- @voyantjs/crm-react@0.30.4
- @voyantjs/finance-react@0.30.4
- @voyantjs/i18n@0.30.4
- @voyantjs/legal-react@0.30.4
- @voyantjs/products-react@0.30.4
- @voyantjs/ui@0.30.4

## 0.30.3

### Patch Changes

- @voyantjs/availability-react@0.30.3
- @voyantjs/bookings-react@0.30.3
- @voyantjs/catalog@0.30.3
- @voyantjs/catalog-react@0.30.3
- @voyantjs/crm-react@0.30.3
- @voyantjs/finance-react@0.30.3
- @voyantjs/i18n@0.30.3
- @voyantjs/legal-react@0.30.3
- @voyantjs/products-react@0.30.3
- @voyantjs/ui@0.30.3

## 0.30.2

### Patch Changes

- @voyantjs/availability-react@0.30.2
- @voyantjs/bookings-react@0.30.2
- @voyantjs/catalog@0.30.2
- @voyantjs/catalog-react@0.30.2
- @voyantjs/crm-react@0.30.2
- @voyantjs/finance-react@0.30.2
- @voyantjs/i18n@0.30.2
- @voyantjs/legal-react@0.30.2
- @voyantjs/products-react@0.30.2
- @voyantjs/ui@0.30.2

## 0.30.1

### Patch Changes

- @voyantjs/availability-react@0.30.1
- @voyantjs/bookings-react@0.30.1
- @voyantjs/catalog@0.30.1
- @voyantjs/catalog-react@0.30.1
- @voyantjs/crm-react@0.30.1
- @voyantjs/finance-react@0.30.1
- @voyantjs/i18n@0.30.1
- @voyantjs/legal-react@0.30.1
- @voyantjs/products-react@0.30.1
- @voyantjs/ui@0.30.1

## 0.30.0

### Patch Changes

- @voyantjs/availability-react@0.30.0
- @voyantjs/bookings-react@0.30.0
- @voyantjs/catalog@0.30.0
- @voyantjs/catalog-react@0.30.0
- @voyantjs/crm-react@0.30.0
- @voyantjs/finance-react@0.30.0
- @voyantjs/i18n@0.30.0
- @voyantjs/legal-react@0.30.0
- @voyantjs/products-react@0.30.0
- @voyantjs/ui@0.30.0

## 0.29.0

### Patch Changes

- Updated dependencies [583326e]
- Updated dependencies [4a6523e]
- Updated dependencies [4a6523e]
- Updated dependencies [4a6523e]
- Updated dependencies [4a6523e]
  - @voyantjs/availability-react@0.29.0
  - @voyantjs/bookings-react@0.29.0
  - @voyantjs/catalog@0.29.0
  - @voyantjs/catalog-react@0.29.0
  - @voyantjs/crm-react@0.29.0
  - @voyantjs/finance-react@0.29.0
  - @voyantjs/i18n@0.29.0
  - @voyantjs/legal-react@0.29.0
  - @voyantjs/products-react@0.29.0
  - @voyantjs/ui@0.29.0

## 0.28.3

### Patch Changes

- Updated dependencies [60ef432]
- Updated dependencies [60ef432]
- Updated dependencies [60ef432]
- Updated dependencies [60ef432]
  - @voyantjs/availability-react@0.28.3
  - @voyantjs/bookings-react@0.28.3
  - @voyantjs/catalog@0.28.3
  - @voyantjs/catalog-react@0.28.3
  - @voyantjs/crm-react@0.28.3
  - @voyantjs/finance-react@0.28.3
  - @voyantjs/i18n@0.28.3
  - @voyantjs/legal-react@0.28.3
  - @voyantjs/products-react@0.28.3
  - @voyantjs/ui@0.28.3

## 0.28.2

### Patch Changes

- @voyantjs/availability-react@0.28.2
- @voyantjs/bookings-react@0.28.2
- @voyantjs/catalog@0.28.2
- @voyantjs/catalog-react@0.28.2
- @voyantjs/crm-react@0.28.2
- @voyantjs/finance-react@0.28.2
- @voyantjs/i18n@0.28.2
- @voyantjs/legal-react@0.28.2
- @voyantjs/products-react@0.28.2
- @voyantjs/ui@0.28.2

## 0.28.1

### Patch Changes

- Updated dependencies [9d88eae]
  - @voyantjs/availability-react@0.28.1
  - @voyantjs/bookings-react@0.28.1
  - @voyantjs/catalog@0.28.1
  - @voyantjs/catalog-react@0.28.1
  - @voyantjs/crm-react@0.28.1
  - @voyantjs/finance-react@0.28.1
  - @voyantjs/i18n@0.28.1
  - @voyantjs/legal-react@0.28.1
  - @voyantjs/products-react@0.28.1
  - @voyantjs/ui@0.28.1

## 0.28.0

### Patch Changes

- @voyantjs/availability-react@0.28.0
- @voyantjs/bookings-react@0.28.0
- @voyantjs/catalog@0.28.0
- @voyantjs/catalog-react@0.28.0
- @voyantjs/crm-react@0.28.0
- @voyantjs/finance-react@0.28.0
- @voyantjs/i18n@0.28.0
- @voyantjs/legal-react@0.28.0
- @voyantjs/products-react@0.28.0
- @voyantjs/ui@0.28.0

## 0.27.0

### Patch Changes

- Updated dependencies [dc46e37]
  - @voyantjs/availability-react@0.27.0
  - @voyantjs/bookings-react@0.27.0
  - @voyantjs/catalog@0.27.0
  - @voyantjs/catalog-react@0.27.0
  - @voyantjs/crm-react@0.27.0
  - @voyantjs/finance-react@0.27.0
  - @voyantjs/i18n@0.27.0
  - @voyantjs/legal-react@0.27.0
  - @voyantjs/products-react@0.27.0
  - @voyantjs/ui@0.27.0

## 0.26.9

### Patch Changes

- Updated dependencies [24a121e]
  - @voyantjs/availability-react@0.26.9
  - @voyantjs/bookings-react@0.26.9
  - @voyantjs/catalog@0.26.9
  - @voyantjs/catalog-react@0.26.9
  - @voyantjs/crm-react@0.26.9
  - @voyantjs/finance-react@0.26.9
  - @voyantjs/i18n@0.26.9
  - @voyantjs/legal-react@0.26.9
  - @voyantjs/products-react@0.26.9
  - @voyantjs/ui@0.26.9

## 0.26.8

### Patch Changes

- abc9aa0: Fall back to `product.sellCurrency` when `price_catalogs.currencyCode` is null in the public pricing snapshot, and stop silently labelling currency-less amounts as EUR.

  - `@voyantjs/pricing`: `getProductPricingSnapshot` now resolves the snapshot's `catalog.currencyCode` from the catalog when set, otherwise from the product's `sellCurrency`. Catalogs with a non-null `currencyCode` behave exactly as before; catalogs with `currency_code = NULL` follow each product's native currency, so multi-currency operators can use a single retail catalog instead of one catalog per currency.
  - `@voyantjs/catalog-ui`: `formatPriceCents` in the catalog detail sheet now renders plain digits (no currency symbol) when no currency is supplied, instead of mis-labelling amounts as EUR.
  - `@voyantjs/bookings-ui`: `formatMoney` in the booking payments summary handles a missing currency the same way.
  - @voyantjs/availability-react@0.26.8
  - @voyantjs/bookings-react@0.26.8
  - @voyantjs/catalog@0.26.8
  - @voyantjs/catalog-react@0.26.8
  - @voyantjs/crm-react@0.26.8
  - @voyantjs/finance-react@0.26.8
  - @voyantjs/i18n@0.26.8
  - @voyantjs/legal-react@0.26.8
  - @voyantjs/products-react@0.26.8
  - @voyantjs/ui@0.26.8

## 0.26.7

### Patch Changes

- @voyantjs/availability-react@0.26.7
- @voyantjs/bookings-react@0.26.7
- @voyantjs/catalog@0.26.7
- @voyantjs/catalog-react@0.26.7
- @voyantjs/crm-react@0.26.7
- @voyantjs/finance-react@0.26.7
- @voyantjs/i18n@0.26.7
- @voyantjs/legal-react@0.26.7
- @voyantjs/products-react@0.26.7
- @voyantjs/ui@0.26.7

## 0.26.6

### Patch Changes

- @voyantjs/availability-react@0.26.6
- @voyantjs/bookings-react@0.26.6
- @voyantjs/catalog@0.26.6
- @voyantjs/catalog-react@0.26.6
- @voyantjs/crm-react@0.26.6
- @voyantjs/finance-react@0.26.6
- @voyantjs/i18n@0.26.6
- @voyantjs/legal-react@0.26.6
- @voyantjs/products-react@0.26.6
- @voyantjs/ui@0.26.6

## 0.26.5

### Patch Changes

- @voyantjs/availability-react@0.26.5
- @voyantjs/bookings-react@0.26.5
- @voyantjs/catalog@0.26.5
- @voyantjs/catalog-react@0.26.5
- @voyantjs/crm-react@0.26.5
- @voyantjs/finance-react@0.26.5
- @voyantjs/i18n@0.26.5
- @voyantjs/legal-react@0.26.5
- @voyantjs/products-react@0.26.5
- @voyantjs/ui@0.26.5

## 0.26.4

### Patch Changes

- Updated dependencies [6493f62]
  - @voyantjs/availability-react@0.26.4
  - @voyantjs/bookings-react@0.26.4
  - @voyantjs/catalog@0.26.4
  - @voyantjs/catalog-react@0.26.4
  - @voyantjs/crm-react@0.26.4
  - @voyantjs/finance-react@0.26.4
  - @voyantjs/i18n@0.26.4
  - @voyantjs/legal-react@0.26.4
  - @voyantjs/products-react@0.26.4
  - @voyantjs/ui@0.26.4

## 0.26.3

### Patch Changes

- Updated dependencies [372cad5]
  - @voyantjs/availability-react@0.26.3
  - @voyantjs/bookings-react@0.26.3
  - @voyantjs/catalog@0.26.3
  - @voyantjs/catalog-react@0.26.3
  - @voyantjs/crm-react@0.26.3
  - @voyantjs/finance-react@0.26.3
  - @voyantjs/i18n@0.26.3
  - @voyantjs/legal-react@0.26.3
  - @voyantjs/products-react@0.26.3
  - @voyantjs/ui@0.26.3

## 0.26.2

### Patch Changes

- @voyantjs/availability-react@0.26.2
- @voyantjs/bookings-react@0.26.2
- @voyantjs/catalog@0.26.2
- @voyantjs/catalog-react@0.26.2
- @voyantjs/crm-react@0.26.2
- @voyantjs/finance-react@0.26.2
- @voyantjs/i18n@0.26.2
- @voyantjs/legal-react@0.26.2
- @voyantjs/products-react@0.26.2
- @voyantjs/ui@0.26.2

## 0.26.1

### Patch Changes

- c0507a6: Move toxic PII to `crm.people` and add structured `person_documents` (closes #440 and #443).

  `user_profiles` is no longer the home for encrypted PII. The four free-text slots (accessibility / dietary / loyalty / insurance) move to `crm.people` so operator-managed humans without auth accounts can carry them, and identity documents graduate to a structured `person_documents` table with type / expiry / issuing authority / attachment + a partial unique index pinning a single primary doc per type per person.

  Booking travelers now snapshot dietary, accessibility, and the primary passport from the linked person record at create time (snapshot-on-create, explicit input always wins) via a new `POST /v1/admin/bookings/:id/travelers/with-travel-details` route. Templates wire the snapshot via `createBookingsHonoModule({ resolveTravelSnapshot })` delegating to `crmService.loadPersonTravelSnapshot` — bookings stays free of any direct CRM dependency.

  Customer portal exposes plaintext `accessibility/dietary/loyalty/insurance` on `/me` plus full CRUD over `/me/documents`. CRM admin gains server-side encrypt/decrypt endpoints (`travel-snapshot`, `profile-pii`, `*/from-plaintext`) so the operator booking-traveler dialog can pre-fill from profile and push diverging values back without the browser holding KMS material. The dialog itself now ships a "Travel details" section with passport / dietary / accessibility fields, plus "Pre-fill from profile" and "Save to profile" affordances when a CRM person is linked.

  Breaking changes (intentionally landed pre-1.0):

  - `user_profiles.documentsEncrypted/accessibilityEncrypted/dietaryEncrypted/loyaltyEncrypted/insuranceEncrypted` columns are removed. Migration ships `templates/operator/migrations/0024_people_pii_documents.sql`.
  - `customerPortalProfileSchema.documents` (array) replaced with separate `accessibility/dietary/loyalty/insurance` plaintext string fields. Document CRUD lives at `/v1/public/customer-portal/me/documents`.
  - `bookingsHonoModule` and `crmHonoModule` are still exported but the env-driven default factory `createBookingsHonoModule()` / `createCrmHonoModule()` is the new recommended entry point.

- Updated dependencies [c0507a6]
  - @voyantjs/availability-react@0.26.1
  - @voyantjs/bookings-react@0.26.1
  - @voyantjs/catalog@0.26.1
  - @voyantjs/catalog-react@0.26.1
  - @voyantjs/crm-react@0.26.1
  - @voyantjs/finance-react@0.26.1
  - @voyantjs/i18n@0.26.1
  - @voyantjs/legal-react@0.26.1
  - @voyantjs/products-react@0.26.1
  - @voyantjs/ui@0.26.1

## 0.26.0

### Patch Changes

- @voyantjs/availability-react@0.26.0
- @voyantjs/bookings-react@0.26.0
- @voyantjs/catalog@0.26.0
- @voyantjs/catalog-react@0.26.0
- @voyantjs/crm-react@0.26.0
- @voyantjs/finance-react@0.26.0
- @voyantjs/i18n@0.26.0
- @voyantjs/legal-react@0.26.0
- @voyantjs/products-react@0.26.0
- @voyantjs/ui@0.26.0

## 0.25.0

### Patch Changes

- @voyantjs/availability-react@0.25.0
- @voyantjs/bookings-react@0.25.0
- @voyantjs/catalog@0.25.0
- @voyantjs/catalog-react@0.25.0
- @voyantjs/crm-react@0.25.0
- @voyantjs/finance-react@0.25.0
- @voyantjs/i18n@0.25.0
- @voyantjs/legal-react@0.25.0
- @voyantjs/products-react@0.25.0
- @voyantjs/ui@0.25.0

## 0.24.3

### Patch Changes

- @voyantjs/availability-react@0.24.3
- @voyantjs/bookings-react@0.24.3
- @voyantjs/catalog@0.24.3
- @voyantjs/catalog-react@0.24.3
- @voyantjs/crm-react@0.24.3
- @voyantjs/finance-react@0.24.3
- @voyantjs/i18n@0.24.3
- @voyantjs/legal-react@0.24.3
- @voyantjs/products-react@0.24.3
- @voyantjs/ui@0.24.3

## 0.24.2

### Patch Changes

- Updated dependencies [bec0471]
  - @voyantjs/availability-react@0.24.2
  - @voyantjs/bookings-react@0.24.2
  - @voyantjs/catalog@0.24.2
  - @voyantjs/catalog-react@0.24.2
  - @voyantjs/crm-react@0.24.2
  - @voyantjs/finance-react@0.24.2
  - @voyantjs/i18n@0.24.2
  - @voyantjs/legal-react@0.24.2
  - @voyantjs/products-react@0.24.2
  - @voyantjs/ui@0.24.2

## 0.24.1

### Patch Changes

- Updated dependencies [ed635c7]
- Updated dependencies [2d6297d]
  - @voyantjs/availability-react@0.24.1
  - @voyantjs/bookings-react@0.24.1
  - @voyantjs/catalog@0.24.1
  - @voyantjs/catalog-react@0.24.1
  - @voyantjs/crm-react@0.24.1
  - @voyantjs/finance-react@0.24.1
  - @voyantjs/i18n@0.24.1
  - @voyantjs/legal-react@0.24.1
  - @voyantjs/products-react@0.24.1
  - @voyantjs/ui@0.24.1

## 0.24.0

### Minor Changes

- 9e1f7b9: Add guarded `BookingJourney` step advancement hooks so storefronts can run asynchronous blocking checks, surface navigation errors, and return normalized draft snapshots before moving to the next step.

### Patch Changes

- @voyantjs/availability-react@0.24.0
- @voyantjs/bookings-react@0.24.0
- @voyantjs/catalog@0.24.0
- @voyantjs/catalog-react@0.24.0
- @voyantjs/crm-react@0.24.0
- @voyantjs/finance-react@0.24.0
- @voyantjs/i18n@0.24.0
- @voyantjs/legal-react@0.24.0
- @voyantjs/products-react@0.24.0
- @voyantjs/ui@0.24.0

## 0.23.0

### Patch Changes

- @voyantjs/availability-react@0.23.0
- @voyantjs/bookings-react@0.23.0
- @voyantjs/catalog@0.23.0
- @voyantjs/catalog-react@0.23.0
- @voyantjs/crm-react@0.23.0
- @voyantjs/finance-react@0.23.0
- @voyantjs/i18n@0.23.0
- @voyantjs/legal-react@0.23.0
- @voyantjs/products-react@0.23.0
- @voyantjs/ui@0.23.0

## 0.22.0

### Patch Changes

- @voyantjs/availability-react@0.22.0
- @voyantjs/bookings-react@0.22.0
- @voyantjs/catalog@0.22.0
- @voyantjs/catalog-react@0.22.0
- @voyantjs/crm-react@0.22.0
- @voyantjs/finance-react@0.22.0
- @voyantjs/i18n@0.22.0
- @voyantjs/legal-react@0.22.0
- @voyantjs/products-react@0.22.0
- @voyantjs/ui@0.22.0

## 0.21.1

### Patch Changes

- @voyantjs/availability-react@0.21.1
- @voyantjs/bookings-react@0.21.1
- @voyantjs/catalog@0.21.1
- @voyantjs/catalog-react@0.21.1
- @voyantjs/crm-react@0.21.1
- @voyantjs/finance-react@0.21.1
- @voyantjs/i18n@0.21.1
- @voyantjs/legal-react@0.21.1
- @voyantjs/products-react@0.21.1
- @voyantjs/ui@0.21.1

## 0.21.0

### Minor Changes

- 6427bad: Release the booking journey architecture train.

  This adds booking hold policy support, richer traveler and booking journey flows, operator tax policy configuration, finance billing and tax policy APIs, notification reminder target and delivery tooling, and the template/runtime wiring needed for the operator storefront checkout flow.

### Patch Changes

- Updated dependencies [6427bad]
  - @voyantjs/availability-react@0.21.0
  - @voyantjs/bookings-react@0.21.0
  - @voyantjs/catalog@0.21.0
  - @voyantjs/catalog-react@0.21.0
  - @voyantjs/crm-react@0.21.0
  - @voyantjs/finance-react@0.21.0
  - @voyantjs/i18n@0.21.0
  - @voyantjs/legal-react@0.21.0
  - @voyantjs/products-react@0.21.0
  - @voyantjs/ui@0.21.0

## 0.20.0

### Patch Changes

- Updated dependencies [cc3eddd]
  - @voyantjs/availability-react@0.20.0
  - @voyantjs/bookings-react@0.20.0
  - @voyantjs/crm-react@0.20.0
  - @voyantjs/finance-react@0.20.0
  - @voyantjs/i18n@0.20.0
  - @voyantjs/legal-react@0.20.0
  - @voyantjs/products-react@0.20.0
  - @voyantjs/ui@0.20.0

## 0.19.0

### Patch Changes

- @voyantjs/availability-react@0.19.0
- @voyantjs/bookings-react@0.19.0
- @voyantjs/crm-react@0.19.0
- @voyantjs/finance-react@0.19.0
- @voyantjs/i18n@0.19.0
- @voyantjs/legal-react@0.19.0
- @voyantjs/products-react@0.19.0
- @voyantjs/ui@0.19.0

## 0.18.0

### Patch Changes

- @voyantjs/availability-react@0.18.0
- @voyantjs/bookings-react@0.18.0
- @voyantjs/crm-react@0.18.0
- @voyantjs/finance-react@0.18.0
- @voyantjs/i18n@0.18.0
- @voyantjs/legal-react@0.18.0
- @voyantjs/products-react@0.18.0
- @voyantjs/ui@0.18.0

## 0.17.0

### Patch Changes

- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
  - @voyantjs/availability-react@0.17.0
  - @voyantjs/bookings-react@0.17.0
  - @voyantjs/crm-react@0.17.0
  - @voyantjs/finance-react@0.17.0
  - @voyantjs/i18n@0.17.0
  - @voyantjs/legal-react@0.17.0
  - @voyantjs/products-react@0.17.0
  - @voyantjs/ui@0.17.0

## 0.16.0

### Patch Changes

- @voyantjs/availability-react@0.16.0
- @voyantjs/bookings-react@0.16.0
- @voyantjs/crm-react@0.16.0
- @voyantjs/finance-react@0.16.0
- @voyantjs/legal-react@0.16.0
- @voyantjs/products-react@0.16.0
- @voyantjs/ui@0.16.0

## 0.15.0

### Minor Changes

- cccc905: Bulk-extract per-domain importable UI packages, mirroring the `*-react` split. 17 new `*-ui` packages shipping a combined 137 components; primitives package `voyant-ui` gains 3 promoted shared primitives (`currency-combobox`, `date-time-picker`, `country-combobox`).

  **New `*-ui` packages**: `booking-requirements`, `bookings`, `charters`, `cruises`, `distribution`, `external-refs`, `extras`, `finance`, `hospitality`, `identity`, `legal`, `markets`, `pricing`, `products`, `resources`, `sellability`, `suppliers`. (Already shipped in prior commit: `crm-ui`.)

  **`voyant-ui` additions**: `CurrencyCombobox`, `DateTimePicker`, `CountryCombobox` — promoted from registry/template-local sources because they're shared primitives that 21 domain components depend on. Adds `@voyantjs/utils` to dependencies.

  **Two distribution modes for every domain**:

  - Importable: `pnpm add @voyantjs/<domain>-ui` — version-tracked, updates flow with bumps
  - Registry: `npx shadcn add @voyant/<component>` — copy + own, fork-friendly

  **Components NOT in importable packages** (registry-only):

  - Router-coupled components (TanStack Router): legal `quotes-page`, `create-quote-dialog`, etc.
  - Template-local-helper-coupled: `@/components/voyant/crm/*` deps, `@/lib/api-client` deps
  - Components with pre-existing latent bugs surfaced by per-package compilation: API drift against `*-react` hooks (e.g., `useBookingItemParticipants` no longer exists), loose typing that worked under permissive consumer tsconfigs but not under strict library compilation, broken imports to skipped sibling components

  The full coupling-and-bug list is preserved in each package's README. These components remain consumable via the shadcn registry path; they can be promoted into the importable packages when their underlying issues are fixed.

  **Domains with no importable surface** (all components either failed to compile or were registry-only by design): `auth`, `ground`, `notifications`, `transactions`. Their components remain available via the registry.

  **Tree-shaking**: `sideEffects: false` is set across all packages. With ESM + Bundler-resolution, modern bundlers (Vite, webpack, Next.js) drop unused named exports through barrels.

### Patch Changes

- Updated dependencies [cccc905]
- Updated dependencies [361c8c5]
- Updated dependencies [e84fe0f]
- Updated dependencies [24869f4]
- Updated dependencies [cccc905]
  - @voyantjs/availability-react@0.15.0
  - @voyantjs/bookings-react@0.15.0
  - @voyantjs/crm-react@0.15.0
  - @voyantjs/finance-react@0.15.0
  - @voyantjs/legal-react@0.15.0
  - @voyantjs/products-react@0.15.0
  - @voyantjs/ui@0.15.0
