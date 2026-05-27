---
"@voyantjs/availability-ui": minor
"@voyantjs/availability-react": minor
"@voyantjs/availability": minor
"@voyantjs/allocation-ui": patch
"@voyantjs/bookings-ui": minor
"@voyantjs/products-ui": minor
"@voyantjs/products": patch
"@voyantjs/finance": patch
"@voyantjs/ui": patch
"@voyantjs/admin": patch
"@voyantjs/i18n": minor
---

Slot-detail / allocation / booking-sheet UX pass.

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
