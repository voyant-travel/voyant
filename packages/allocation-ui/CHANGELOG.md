# @voyantjs/allocation-ui

## 0.108.0

### Patch Changes

- Updated dependencies [6c27159]
  - @voyantjs/availability-react@0.107.0

## 0.107.0

### Patch Changes

- Updated dependencies [f245b55]
- Updated dependencies [3bd66e9]
- Updated dependencies [344e7b6]
  - @voyantjs/availability-react@0.106.0
  - @voyantjs/ui@0.106.0

## 0.106.0

### Patch Changes

- Updated dependencies [7122c2a]
  - @voyantjs/i18n@0.106.0
  - @voyantjs/ui@0.105.1
  - @voyantjs/availability-react@0.105.2

## 0.105.0

### Patch Changes

- Updated dependencies [d1ad572]
  - @voyantjs/i18n@0.105.0
  - @voyantjs/ui@0.105.0
  - @voyantjs/availability-react@0.105.0

## 0.104.1

### Patch Changes

- @voyantjs/availability-react@0.104.1
- @voyantjs/i18n@0.104.1
- @voyantjs/ui@0.104.1

## 0.104.0

### Patch Changes

- Updated dependencies [e2ae9ff]
  - @voyantjs/availability-react@0.104.0
  - @voyantjs/i18n@0.104.0
  - @voyantjs/ui@0.104.0

## 0.103.0

### Patch Changes

- Updated dependencies [a02f2f3]
  - @voyantjs/availability-react@0.103.0
  - @voyantjs/i18n@0.103.0
  - @voyantjs/ui@0.103.0

## 0.102.0

### Minor Changes

- b6d0673: Redesign the operator's **Booking options & prices** for low-tech travel agents and close the inventory/allocation gaps it exposed.

  - `@voyantjs/products-ui`: each option now renders **one adaptive table** — a rooms grid (rooms × traveler types) or a per-person seats list — derived from the product's inventory (rooms always win over booking mode). The rate-plan layer is hidden behind an **Advanced** disclosure (a single default plan is auto-managed); the default plan's matrix is no longer duplicated there. Single-option products show the table directly with no chrome. The unit form pins its type in the contextual add ("Add room" can't create a vehicle) and uses type-aware quantity/occupancy labels; the price dialog uses the design-system currency input and pricing-mode-aware quantity labels. New departures pre-fill **Capacity (pax)** from the configured inventory (overridable).
  - `@voyantjs/products`: `createProduct` seeds a default `Standard` option so new products open straight into the pricing table; the day-translation create route now verifies the day belongs to the product.
  - `@voyantjs/availability` + `@voyantjs/availability-react`: departure inventory templates can be **generated from the option's rooms** and **applied to existing open departures** (new bulk endpoint + hook). The full-inventory materializer now works for product-level departures (no `optionId`), so auto-seed on publish and bulk apply create the full room set. New per-slot `materialize-templates` endpoint.
  - `@voyantjs/allocation-ui`: a slot's **Generate resources** now materializes the full configured inventory across all kinds in one click, instead of the pax-derived single-kind path.

### Patch Changes

- Updated dependencies [b6d0673]
  - @voyantjs/availability-react@0.102.0
  - @voyantjs/i18n@0.102.0
  - @voyantjs/ui@0.102.0

## 0.101.2

### Patch Changes

- Updated dependencies [577eaf5]
- Updated dependencies [577eaf5]
  - @voyantjs/availability-react@0.101.2
  - @voyantjs/i18n@0.101.2
  - @voyantjs/ui@0.101.2

## 0.101.1

### Patch Changes

- Updated dependencies [f736ba5]
  - @voyantjs/availability-react@0.101.1
  - @voyantjs/i18n@0.101.1
  - @voyantjs/ui@0.101.1

## 0.101.0

### Patch Changes

- @voyantjs/availability-react@0.101.0
- @voyantjs/i18n@0.101.0
- @voyantjs/ui@0.101.0

## 0.100.0

### Patch Changes

- @voyantjs/availability-react@0.100.0
- @voyantjs/i18n@0.100.0
- @voyantjs/ui@0.100.0

## 0.99.0

### Patch Changes

- @voyantjs/availability-react@0.99.0
- @voyantjs/i18n@0.99.0
- @voyantjs/ui@0.99.0

## 0.98.0

### Patch Changes

- @voyantjs/availability-react@0.98.0
- @voyantjs/i18n@0.98.0
- @voyantjs/ui@0.98.0

## 0.97.0

### Patch Changes

- @voyantjs/availability-react@0.97.0
- @voyantjs/i18n@0.97.0
- @voyantjs/ui@0.97.0

## 0.96.0

### Patch Changes

- @voyantjs/availability-react@0.96.0
- @voyantjs/i18n@0.96.0
- @voyantjs/ui@0.96.0

## 0.95.0

### Patch Changes

- @voyantjs/availability-react@0.95.0
- @voyantjs/i18n@0.95.0
- @voyantjs/ui@0.95.0

## 0.94.0

### Patch Changes

- @voyantjs/availability-react@0.94.0
- @voyantjs/i18n@0.94.0
- @voyantjs/ui@0.94.0

## 0.93.0

### Patch Changes

- @voyantjs/availability-react@0.93.0
- @voyantjs/i18n@0.93.0
- @voyantjs/ui@0.93.0

## 0.92.0

### Patch Changes

- @voyantjs/availability-react@0.92.0
- @voyantjs/i18n@0.92.0
- @voyantjs/ui@0.92.0

## 0.91.0

### Patch Changes

- @voyantjs/availability-react@0.91.0
- @voyantjs/i18n@0.91.0
- @voyantjs/ui@0.91.0

## 0.90.0

### Patch Changes

- @voyantjs/availability-react@0.90.0
- @voyantjs/i18n@0.90.0
- @voyantjs/ui@0.90.0

## 0.89.0

### Patch Changes

- @voyantjs/availability-react@0.89.0
- @voyantjs/i18n@0.89.0
- @voyantjs/ui@0.89.0

## 0.88.0

### Patch Changes

- @voyantjs/availability-react@0.88.0
- @voyantjs/i18n@0.88.0
- @voyantjs/ui@0.88.0

## 0.87.1

### Patch Changes

- @voyantjs/availability-react@0.87.1
- @voyantjs/i18n@0.87.1
- @voyantjs/ui@0.87.1

## 0.87.0

### Patch Changes

- @voyantjs/availability-react@0.87.0
- @voyantjs/i18n@0.87.0
- @voyantjs/ui@0.87.0

## 0.86.0

### Patch Changes

- @voyantjs/availability-react@0.86.0
- @voyantjs/i18n@0.86.0
- @voyantjs/ui@0.86.0

## 0.85.4

### Patch Changes

- @voyantjs/availability-react@0.85.4
- @voyantjs/i18n@0.85.4
- @voyantjs/ui@0.85.4

## 0.85.3

### Patch Changes

- @voyantjs/availability-react@0.85.3
- @voyantjs/i18n@0.85.3
- @voyantjs/ui@0.85.3

## 0.85.2

### Patch Changes

- @voyantjs/availability-react@0.85.2
- @voyantjs/i18n@0.85.2
- @voyantjs/ui@0.85.2

## 0.85.1

### Patch Changes

- @voyantjs/availability-react@0.85.1
- @voyantjs/i18n@0.85.1
- @voyantjs/ui@0.85.1

## 0.85.0

### Patch Changes

- @voyantjs/availability-react@0.85.0
- @voyantjs/i18n@0.85.0
- @voyantjs/ui@0.85.0

## 0.84.4

### Patch Changes

- @voyantjs/availability-react@0.84.4
- @voyantjs/i18n@0.84.4
- @voyantjs/ui@0.84.4

## 0.84.3

### Patch Changes

- Updated dependencies [9eadf50]
  - @voyantjs/availability-react@0.84.3
  - @voyantjs/i18n@0.84.3
  - @voyantjs/ui@0.84.3

## 0.84.2

### Patch Changes

- @voyantjs/availability-react@0.84.2
- @voyantjs/i18n@0.84.2
- @voyantjs/ui@0.84.2

## 0.84.1

### Patch Changes

- @voyantjs/availability-react@0.84.1
- @voyantjs/i18n@0.84.1
- @voyantjs/ui@0.84.1

## 0.84.0

### Patch Changes

- Updated dependencies [5462f07]
  - @voyantjs/availability-react@0.84.0
  - @voyantjs/i18n@0.84.0
  - @voyantjs/ui@0.84.0

## 0.83.1

### Patch Changes

- @voyantjs/availability-react@0.83.1
- @voyantjs/i18n@0.83.1
- @voyantjs/ui@0.83.1

## 0.83.0

### Patch Changes

- @voyantjs/availability-react@0.83.0
- @voyantjs/i18n@0.83.0
- @voyantjs/ui@0.83.0

## 0.82.1

### Patch Changes

- @voyantjs/availability-react@0.82.1
- @voyantjs/i18n@0.82.1
- @voyantjs/ui@0.82.1

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
  - @voyantjs/availability-react@0.82.0
  - @voyantjs/i18n@0.82.0
  - @voyantjs/ui@0.82.0

## 0.81.21

### Patch Changes

- @voyantjs/availability-react@0.81.21
- @voyantjs/i18n@0.81.21
- @voyantjs/ui@0.81.21

## 0.81.20

### Patch Changes

- @voyantjs/availability-react@0.81.20
- @voyantjs/i18n@0.81.20
- @voyantjs/ui@0.81.20

## 0.81.19

### Patch Changes

- @voyantjs/availability-react@0.81.19
- @voyantjs/i18n@0.81.19
- @voyantjs/ui@0.81.19

## 0.81.18

### Patch Changes

- Updated dependencies [93874e4]
  - @voyantjs/availability-react@0.81.18
  - @voyantjs/i18n@0.81.18
  - @voyantjs/ui@0.81.18

## 0.81.17

### Patch Changes

- Updated dependencies [e31a008]
  - @voyantjs/availability-react@0.81.17
  - @voyantjs/i18n@0.81.17
  - @voyantjs/ui@0.81.17

## 0.81.16

### Patch Changes

- Updated dependencies [0a617cc]
  - @voyantjs/availability-react@0.81.16
  - @voyantjs/i18n@0.81.16
  - @voyantjs/ui@0.81.16

## 0.81.15

### Patch Changes

- @voyantjs/availability-react@0.81.15
- @voyantjs/i18n@0.81.15
- @voyantjs/ui@0.81.15

## 0.81.14

### Patch Changes

- @voyantjs/availability-react@0.81.14
- @voyantjs/i18n@0.81.14
- @voyantjs/ui@0.81.14

## 0.81.13

### Patch Changes

- Updated dependencies [36421aa]
  - @voyantjs/availability-react@0.81.13
  - @voyantjs/i18n@0.81.13
  - @voyantjs/ui@0.81.13

## 0.81.12

### Patch Changes

- @voyantjs/availability-react@0.81.12
- @voyantjs/i18n@0.81.12
- @voyantjs/ui@0.81.12

## 0.81.11

### Patch Changes

- @voyantjs/availability-react@0.81.11
- @voyantjs/i18n@0.81.11
- @voyantjs/ui@0.81.11

## 0.81.10

### Patch Changes

- @voyantjs/availability-react@0.81.10
- @voyantjs/i18n@0.81.10
- @voyantjs/ui@0.81.10

## 0.81.9

### Patch Changes

- @voyantjs/availability-react@0.81.9
- @voyantjs/i18n@0.81.9
- @voyantjs/ui@0.81.9

## 0.81.8

### Patch Changes

- @voyantjs/availability-react@0.81.8
- @voyantjs/i18n@0.81.8
- @voyantjs/ui@0.81.8

## 0.81.7

### Patch Changes

- @voyantjs/availability-react@0.81.7
- @voyantjs/i18n@0.81.7
- @voyantjs/ui@0.81.7

## 0.81.6

### Patch Changes

- @voyantjs/availability-react@0.81.6
- @voyantjs/i18n@0.81.6
- @voyantjs/ui@0.81.6

## 0.81.5

### Patch Changes

- @voyantjs/availability-react@0.81.5
- @voyantjs/i18n@0.81.5
- @voyantjs/ui@0.81.5

## 0.81.4

### Patch Changes

- @voyantjs/availability-react@0.81.4
- @voyantjs/i18n@0.81.4
- @voyantjs/ui@0.81.4

## 0.81.3

### Patch Changes

- 334b531: Show booked passengers on slot allocation pages that have no resource allocation kinds.
- Updated dependencies [f157bcd]
  - @voyantjs/availability-react@0.81.3
  - @voyantjs/i18n@0.81.3
  - @voyantjs/ui@0.81.3

## 0.81.2

### Patch Changes

- @voyantjs/availability-react@0.81.2
- @voyantjs/i18n@0.81.2
- @voyantjs/ui@0.81.2

## 0.81.1

### Patch Changes

- @voyantjs/availability-react@0.81.1
- @voyantjs/i18n@0.81.1
- @voyantjs/ui@0.81.1

## 0.81.0

### Patch Changes

- @voyantjs/availability-react@0.81.0
- @voyantjs/i18n@0.81.0
- @voyantjs/ui@0.81.0

## 0.80.18

### Patch Changes

- @voyantjs/availability-react@0.80.18
- @voyantjs/i18n@0.80.18
- @voyantjs/ui@0.80.18

## 0.80.17

### Patch Changes

- @voyantjs/availability-react@0.80.17
- @voyantjs/i18n@0.80.17
- @voyantjs/ui@0.80.17

## 0.80.16

### Patch Changes

- Updated dependencies [dbcc0da]
  - @voyantjs/availability-react@0.80.16
  - @voyantjs/i18n@0.80.16
  - @voyantjs/ui@0.80.16

## 0.80.15

### Patch Changes

- @voyantjs/availability-react@0.80.15
- @voyantjs/i18n@0.80.15
- @voyantjs/ui@0.80.15

## 0.80.14

### Patch Changes

- @voyantjs/availability-react@0.80.14
- @voyantjs/i18n@0.80.14
- @voyantjs/ui@0.80.14

## 0.80.13

### Patch Changes

- 86f13fb: Add an opt-in slot allocation create-booking action and allow booking creation to lock a default slot.
  - @voyantjs/availability-react@0.80.13
  - @voyantjs/i18n@0.80.13
  - @voyantjs/ui@0.80.13

## 0.80.12

### Patch Changes

- f6ebb68: Hide allocation tabs when a slot has no matching resources or templates.
- Updated dependencies [5070731]
  - @voyantjs/availability-react@0.80.12
  - @voyantjs/i18n@0.80.12
  - @voyantjs/ui@0.80.12

## 0.80.11

### Patch Changes

- @voyantjs/availability-react@0.80.11
- @voyantjs/i18n@0.80.11
- @voyantjs/ui@0.80.11

## 0.80.10

### Patch Changes

- @voyantjs/availability-react@0.80.10
- @voyantjs/i18n@0.80.10
- @voyantjs/ui@0.80.10

## 0.80.9

### Patch Changes

- @voyantjs/availability-react@0.80.9
- @voyantjs/i18n@0.80.9
- @voyantjs/ui@0.80.9

## 0.80.8

### Patch Changes

- @voyantjs/availability-react@0.80.8
- @voyantjs/i18n@0.80.8
- @voyantjs/ui@0.80.8

## 0.80.7

### Patch Changes

- @voyantjs/availability-react@0.80.7
- @voyantjs/i18n@0.80.7
- @voyantjs/ui@0.80.7

## 0.80.6

### Patch Changes

- @voyantjs/availability-react@0.80.6
- @voyantjs/i18n@0.80.6
- @voyantjs/ui@0.80.6

## 0.80.5

### Patch Changes

- @voyantjs/availability-react@0.80.5
- @voyantjs/i18n@0.80.5
- @voyantjs/ui@0.80.5

## 0.80.4

### Patch Changes

- @voyantjs/availability-react@0.80.4
- @voyantjs/i18n@0.80.4
- @voyantjs/ui@0.80.4

## 0.80.3

### Patch Changes

- @voyantjs/availability-react@0.80.3
- @voyantjs/i18n@0.80.3
- @voyantjs/ui@0.80.3

## 0.80.2

### Patch Changes

- @voyantjs/availability-react@0.80.2
- @voyantjs/i18n@0.80.2
- @voyantjs/ui@0.80.2

## 0.80.1

### Patch Changes

- @voyantjs/availability-react@0.80.1
- @voyantjs/i18n@0.80.1
- @voyantjs/ui@0.80.1

## 0.80.0

### Patch Changes

- Updated dependencies [9473eb8]
  - @voyantjs/availability-react@0.80.0
  - @voyantjs/i18n@0.80.0
  - @voyantjs/ui@0.80.0

## 0.79.0

### Patch Changes

- @voyantjs/availability-react@0.79.0
- @voyantjs/i18n@0.79.0
- @voyantjs/ui@0.79.0

## 0.78.0

### Patch Changes

- @voyantjs/availability-react@0.78.0
- @voyantjs/i18n@0.78.0
- @voyantjs/ui@0.78.0

## 0.77.13

### Patch Changes

- @voyantjs/availability-react@0.77.13
- @voyantjs/i18n@0.77.13
- @voyantjs/ui@0.77.13

## 0.77.12

### Patch Changes

- Updated dependencies [bf74cd4]
  - @voyantjs/availability-react@0.77.12
  - @voyantjs/i18n@0.77.12
  - @voyantjs/ui@0.77.12

## 0.77.11

### Patch Changes

- @voyantjs/availability-react@0.77.11
- @voyantjs/i18n@0.77.11
- @voyantjs/ui@0.77.11

## 0.77.10

### Patch Changes

- @voyantjs/availability-react@0.77.10
- @voyantjs/i18n@0.77.10
- @voyantjs/ui@0.77.10

## 0.77.9

### Patch Changes

- @voyantjs/availability-react@0.77.9
- @voyantjs/i18n@0.77.9
- @voyantjs/ui@0.77.9

## 0.77.8

### Patch Changes

- @voyantjs/availability-react@0.77.8
- @voyantjs/i18n@0.77.8
- @voyantjs/ui@0.77.8

## 0.77.7

### Patch Changes

- @voyantjs/availability-react@0.77.7
- @voyantjs/i18n@0.77.7
- @voyantjs/ui@0.77.7

## 0.77.6

### Patch Changes

- @voyantjs/availability-react@0.77.6
- @voyantjs/i18n@0.77.6
- @voyantjs/ui@0.77.6

## 0.77.5

### Patch Changes

- @voyantjs/availability-react@0.77.5
- @voyantjs/i18n@0.77.5
- @voyantjs/ui@0.77.5

## 0.77.4

### Patch Changes

- @voyantjs/availability-react@0.77.4
- @voyantjs/i18n@0.77.4
- @voyantjs/ui@0.77.4

## 0.77.3

### Patch Changes

- @voyantjs/availability-react@0.77.3
- @voyantjs/i18n@0.77.3
- @voyantjs/ui@0.77.3

## 0.77.2

### Patch Changes

- @voyantjs/availability-react@0.77.2
- @voyantjs/i18n@0.77.2
- @voyantjs/ui@0.77.2

## 0.77.1

### Patch Changes

- @voyantjs/availability-react@0.77.1
- @voyantjs/i18n@0.77.1
- @voyantjs/ui@0.77.1

## 0.77.0

### Patch Changes

- @voyantjs/availability-react@0.77.0
- @voyantjs/i18n@0.77.0
- @voyantjs/ui@0.77.0

## 0.76.0

### Patch Changes

- @voyantjs/availability-react@0.76.0
- @voyantjs/i18n@0.76.0
- @voyantjs/ui@0.76.0

## 0.75.7

### Patch Changes

- @voyantjs/availability-react@0.75.7
- @voyantjs/i18n@0.75.7
- @voyantjs/ui@0.75.7

## 0.75.6

### Patch Changes

- @voyantjs/availability-react@0.75.6
- @voyantjs/i18n@0.75.6
- @voyantjs/ui@0.75.6

## 0.75.5

### Patch Changes

- @voyantjs/availability-react@0.75.5
- @voyantjs/i18n@0.75.5
- @voyantjs/ui@0.75.5

## 0.75.4

### Patch Changes

- @voyantjs/availability-react@0.75.4
- @voyantjs/i18n@0.75.4
- @voyantjs/ui@0.75.4

## 0.75.3

### Patch Changes

- Updated dependencies [38167cd]
  - @voyantjs/availability-react@0.75.3
  - @voyantjs/i18n@0.75.3
  - @voyantjs/ui@0.75.3

## 0.75.2

### Patch Changes

- @voyantjs/availability-react@0.75.2
- @voyantjs/i18n@0.75.2
- @voyantjs/ui@0.75.2

## 0.75.1

### Patch Changes

- @voyantjs/availability-react@0.75.1
- @voyantjs/i18n@0.75.1
- @voyantjs/ui@0.75.1

## 0.75.0

### Patch Changes

- @voyantjs/availability-react@0.75.0
- @voyantjs/i18n@0.75.0
- @voyantjs/ui@0.75.0

## 0.74.2

### Patch Changes

- @voyantjs/availability-react@0.74.2
- @voyantjs/i18n@0.74.2
- @voyantjs/ui@0.74.2

## 0.74.1

### Patch Changes

- @voyantjs/availability-react@0.74.1
- @voyantjs/i18n@0.74.1
- @voyantjs/ui@0.74.1

## 0.74.0

### Patch Changes

- @voyantjs/availability-react@0.74.0
- @voyantjs/i18n@0.74.0
- @voyantjs/ui@0.74.0

## 0.73.1

### Patch Changes

- @voyantjs/availability-react@0.73.1
- @voyantjs/i18n@0.73.1
- @voyantjs/ui@0.73.1

## 0.73.0

### Patch Changes

- @voyantjs/availability-react@0.73.0
- @voyantjs/i18n@0.73.0
- @voyantjs/ui@0.73.0

## 0.72.0

### Patch Changes

- @voyantjs/availability-react@0.72.0
- @voyantjs/i18n@0.72.0
- @voyantjs/ui@0.72.0

## 0.71.0

### Minor Changes

- 9bdc9a6: Add a visual seat-map builder for vehicle_seat resource templates. Operators can now draw the bus layout cell-by-cell with explicit `seat`, `aisle`, `door`, and `void` kinds — supporting odd bus shapes (mid-coach doors, wheelchair voids, asymmetric back rows) the legacy `layout` string couldn't express. A new `<SeatMapBuilder />` ships from `@voyantjs/allocation-ui`; the backend materializer walks the saved `layoutSpec` to create exactly the seats drawn, with positions derived from neighbouring cells; and `VehicleSeatsView` renders the map with visible aisle gaps and a striped door row when a spec is present. The legacy `layout` string path stays as the fallback when no spec is configured.

### Patch Changes

- Updated dependencies [9bdc9a6]
  - @voyantjs/availability-react@0.71.0
  - @voyantjs/i18n@0.71.0
  - @voyantjs/ui@0.71.0

## 0.70.0

### Minor Changes

- 09d5f82: Allocation chip polish:

  - **Fix #1079**: `derivePaymentStatus` now falls back to `bookings.paid_at` and the sum of paid `booking_payment_schedules` before declaring a booking unpaid via invoice math. Operators who bill via deposit milestones (or who confirm bookings without issuing an invoice) no longer see false-red allocation chips. Manifest SQL surfaces `paid_at`, `created_at`, and `schedules_paid_cents`; the rollup checks them in order before falling through to the legacy invoice rule.
  - **Booking sequence numbers**: each booking gets a slot-local 1-based ordinal (by `bookings.created_at`), surfaced on `AllocationManifestBooking` and `AllocationManifestTraveler` as `bookingSequence`. All chips for the same booking render with a `(N)` prefix so operators can scan the resource grid and spot at a glance which travelers belong together.
  - **Visible payment-status colors**: `paymentStatusChipClass` bumped from `/5 + /40` (basically invisible on dark themes) to `/20 + /70` plus an explicit text color. Lives in `slot-allocation-shared` so both the resource view and the seat view share the same look.
  - **Seat-view parity**: `VehicleSeatCell` now applies the payment-status color + tooltip and shows the `(N)` prefix on the occupant name. The booking ref click-through was already there; this aligns the rest of the affordances with the room view.

### Patch Changes

- Updated dependencies [09d5f82]
  - @voyantjs/availability-react@0.70.0
  - @voyantjs/i18n@0.70.0
  - @voyantjs/ui@0.70.0

## 0.69.1

### Patch Changes

- @voyantjs/availability-react@0.69.1
- @voyantjs/i18n@0.69.1
- @voyantjs/ui@0.69.1

## 0.69.0

### Patch Changes

- @voyantjs/availability-react@0.69.0
- @voyantjs/i18n@0.69.0
- @voyantjs/ui@0.69.0

## 0.68.0

### Patch Changes

- @voyantjs/availability-react@0.68.0
- @voyantjs/i18n@0.68.0
- @voyantjs/ui@0.68.0

## 0.67.0

### Patch Changes

- @voyantjs/availability-react@0.67.0
- @voyantjs/i18n@0.67.0
- @voyantjs/ui@0.67.0

## 0.66.6

### Patch Changes

- @voyantjs/availability-react@0.66.6
- @voyantjs/i18n@0.66.6
- @voyantjs/ui@0.66.6

## 0.66.5

### Patch Changes

- @voyantjs/availability-react@0.66.5
- @voyantjs/i18n@0.66.5
- @voyantjs/ui@0.66.5

## 0.66.4

### Patch Changes

- @voyantjs/availability-react@0.66.4
- @voyantjs/i18n@0.66.4
- @voyantjs/ui@0.66.4

## 0.66.3

### Patch Changes

- @voyantjs/availability-react@0.66.3
- @voyantjs/i18n@0.66.3
- @voyantjs/ui@0.66.3

## 0.66.2

### Patch Changes

- Updated dependencies [3608633]
  - @voyantjs/availability-react@0.66.2
  - @voyantjs/i18n@0.66.2
  - @voyantjs/ui@0.66.2

## 0.66.1

### Patch Changes

- @voyantjs/availability-react@0.66.1
- @voyantjs/i18n@0.66.1
- @voyantjs/ui@0.66.1

## 0.66.0

### Patch Changes

- Updated dependencies [a74089c]
  - @voyantjs/availability-react@0.66.0
  - @voyantjs/i18n@0.66.0
  - @voyantjs/ui@0.66.0

## 0.65.0

### Patch Changes

- @voyantjs/availability-react@0.65.0
- @voyantjs/i18n@0.65.0
- @voyantjs/ui@0.65.0

## 0.64.1

### Patch Changes

- @voyantjs/availability-react@0.64.1
- @voyantjs/i18n@0.64.1
- @voyantjs/ui@0.64.1

## 0.64.0

### Patch Changes

- @voyantjs/availability-react@0.64.0
- @voyantjs/i18n@0.64.0
- @voyantjs/ui@0.64.0

## 0.63.1

### Patch Changes

- @voyantjs/availability-react@0.63.1
- @voyantjs/i18n@0.63.1
- @voyantjs/ui@0.63.1

## 0.63.0

### Minor Changes

- 5bff9c3: Allocation view: click traveler's booking number to open it; color-code chips by payment status.

  `@voyantjs/availability`

  - Slot allocation manifest now carries an aggregated `paymentStatus` (`paid` / `partial` / `unpaid`) on both `AllocationManifestBooking` and `AllocationManifestTraveler`. Derived from a LEFT JOIN against `invoices` (sum of `total_cents` / `paid_cents` per booking, excluding `void` invoices):
    - `paid` when fully settled, or when the booking has `sell_amount_cents <= 0` (free).
    - `partial` when any payment landed but balance remains.
    - `unpaid` when nothing has been paid, including the "no invoices issued yet" case.
  - Fallback path: when the `invoices` table doesn't exist (catalog-less / finance-less deploys), the loader retries without the join and every booking ends up `unpaid`. No crash on missing schema.
  - New exported type `AllocationPaymentStatus`.

  `@voyantjs/availability-react`

  - `allocationManifestTravelerSchema` and `allocationManifestBookingSchema` expose `paymentStatus` (defaults to `unpaid` for older API responses).
  - New exports: `allocationPaymentStatusSchema`, `AllocationPaymentStatus`.

  `@voyantjs/allocation-ui`

  - `SlotAllocationPage` accepts a new `onBookingOpen?: (bookingId: string) => void` callback. When provided, every booking number on a chip / row becomes a `<button>` that fires the callback — the host decides whether to open a side panel, navigate, etc. Threaded through `ResourceColumnsView`, `ResourceGroupTable`, `ResourceRow`, `TravelerChip`, `UnallocatedTravelersTable`, `VehicleSeatsView`, and `VehicleSeatCell`.
  - `TravelerChip` border + background tint reflects `traveler.paymentStatus` — emerald for paid, amber for partial, rose for unpaid (light tint over the existing border). Tooltip surfaces the localized label.
  - Unallocated rows pick up the same color cue (text-only, not full-width) on the booking-number column so a quick scan tells the operator what's outstanding.
  - New `paymentStatusLabels` i18n group on `AllocationUiMessages` (EN + RO).

### Patch Changes

- Updated dependencies [5bff9c3]
  - @voyantjs/availability-react@0.63.0
  - @voyantjs/i18n@0.63.0
  - @voyantjs/ui@0.63.0

## 0.62.3

### Patch Changes

- @voyantjs/availability-react@0.62.3
- @voyantjs/i18n@0.62.3
- @voyantjs/ui@0.62.3

## 0.62.2

### Patch Changes

- @voyantjs/availability-react@0.62.2
- @voyantjs/i18n@0.62.2
- @voyantjs/ui@0.62.2

## 0.62.1

### Patch Changes

- @voyantjs/availability-react@0.62.1
- @voyantjs/i18n@0.62.1
- @voyantjs/ui@0.62.1

## 0.62.0

### Patch Changes

- @voyantjs/availability-react@0.62.0
- @voyantjs/i18n@0.62.0
- @voyantjs/ui@0.62.0

## 0.61.0

### Patch Changes

- Updated dependencies [89f033e]
  - @voyantjs/availability-react@0.61.0
  - @voyantjs/i18n@0.61.0
  - @voyantjs/ui@0.61.0

## 0.60.0

### Patch Changes

- @voyantjs/availability-react@0.60.0
- @voyantjs/i18n@0.60.0
- @voyantjs/ui@0.60.0

## 0.59.0

### Patch Changes

- Updated dependencies [48927be]
  - @voyantjs/availability-react@0.59.0
  - @voyantjs/i18n@0.59.0
  - @voyantjs/ui@0.59.0

## 0.58.0

### Patch Changes

- @voyantjs/availability-react@0.58.0
- @voyantjs/i18n@0.58.0
- @voyantjs/ui@0.58.0

## 0.57.0

### Patch Changes

- @voyantjs/availability-react@0.57.0
- @voyantjs/i18n@0.57.0
- @voyantjs/ui@0.57.0

## 0.56.0

### Patch Changes

- @voyantjs/availability-react@0.56.0
- @voyantjs/i18n@0.56.0
- @voyantjs/ui@0.56.0

## 0.55.1

### Patch Changes

- Updated dependencies [819c847]
  - @voyantjs/availability-react@0.55.1
  - @voyantjs/i18n@0.55.1
  - @voyantjs/ui@0.55.1

## 0.55.0

### Patch Changes

- @voyantjs/availability-react@0.55.0
- @voyantjs/i18n@0.55.0
- @voyantjs/ui@0.55.0

## 0.54.0

### Patch Changes

- @voyantjs/availability-react@0.54.0
- @voyantjs/i18n@0.54.0
- @voyantjs/ui@0.54.0

## 0.53.2

### Patch Changes

- @voyantjs/availability-react@0.53.2
- @voyantjs/i18n@0.53.2
- @voyantjs/ui@0.53.2

## 0.53.1

### Patch Changes

- @voyantjs/availability-react@0.53.1
- @voyantjs/i18n@0.53.1
- @voyantjs/ui@0.53.1

## 0.53.0

### Patch Changes

- @voyantjs/availability-react@0.53.0
- @voyantjs/i18n@0.53.0
- @voyantjs/ui@0.53.0

## 0.52.4

### Patch Changes

- Updated dependencies [5d3c119]
  - @voyantjs/availability-react@0.52.4
  - @voyantjs/i18n@0.52.4
  - @voyantjs/ui@0.52.4

## 0.52.3

### Patch Changes

- @voyantjs/availability-react@0.52.3
- @voyantjs/i18n@0.52.3
- @voyantjs/ui@0.52.3

## 0.52.2

### Patch Changes

- 3e09123: Extract availability/allocation detail pages into shared packages.

  - `AvailabilitySlotDetailPage`, the availability rule detail page, and the start-time detail page are now provided by `@voyantjs/availability-ui` so templates render the same surfaces instead of forking them. `templates/operator` deletes its local copies and the `_workspace/availability/*` routes mount the package components directly.
  - `SlotAllocationPage` and `SlotAllocationResourceView` rebuilt: resource columns now scroll independently, the empty-state branch handles slots with no travelers, and the shared header drives selection/auto-assign actions from one place.
  - `@voyantjs/availability` service-allocation tightens validation around resource-template links so the allocation manifest stays consistent when resource pools change mid-slot.
  - New `OptionResourceTemplatesPanel` (in the operator template) consumed by the availability detail surface to expose resource-template wiring per option.

- Updated dependencies [3e09123]
- Updated dependencies [6bdfcbc]
- Updated dependencies [3e09123]
  - @voyantjs/availability-react@0.52.2
  - @voyantjs/i18n@0.52.2
  - @voyantjs/ui@0.52.2

## 0.52.1

### Patch Changes

- @voyantjs/availability-react@0.52.1
- @voyantjs/i18n@0.52.1
- @voyantjs/ui@0.52.1

## 0.52.0

### Patch Changes

- @voyantjs/availability-react@0.52.0
- @voyantjs/i18n@0.52.0
- @voyantjs/ui@0.52.0

## 0.51.1

### Patch Changes

- Updated dependencies [deaacb3]
  - @voyantjs/availability-react@0.51.1
  - @voyantjs/i18n@0.51.1
  - @voyantjs/ui@0.51.1

## 0.51.0

### Minor Changes

- 2316791: Add an inline edit affordance for allocation resources on `SlotAllocationPage`. Each resource row in the new per-sub-type table now has a pencil button that toggles a label + capacity form alongside the existing remove button. Capacity floors at `max(1, occupants.length)` so the form cannot shrink a bucket below the travelers already sitting in it. Wired to the already-exposed `resourceMutation.update.mutateAsync`, so the resource id stays stable across edits (no more delete-and-recreate churn that broke holds and audit refs).
- 2316791: Redesign `SlotAllocationPage` around an operator-class workflow.

  - **Capacity context.** Header surfaces "Slot pax: N/M" + "Resource capacity: X/M" with a coloured delta badge (fits / matches / over) so operators no longer have to navigate back to the slot detail to check the ceiling.
  - **Over-capacity guard.** The inline "Add resource" form shows a soft warning when the new resource would push total resource capacity above the slot's initial pax — soft, not blocking, so intentional oversells still go through.
  - **Card grid → table per sub-type.** `ResourceColumnsView` now renders one `<Table>` per sub-type group (DBL/SGL/TPL sections), one row per resource with Label · Capacity · Occupants (chip stack) · Edit / Remove. Replaces the alphabetic interleave that made scanning "all DBLs" require reading every other card.
  - **Drag-and-drop → click-to-allocate.** Each row has a "+ Assign" button that opens a `Popover` with a `Command`-driven picker of unallocated travelers — searchable, keyboard-friendly, accessible by default. Each occupant chip has an inline × to unassign. `VehicleSeatsView` cells switch to the same pattern.
  - **Embedded mode.** New `embed?: boolean` prop drops the page-level header so the body can be mounted inside a tab without a duplicate h1; capacity badges + actions cluster stay as an inline toolbar so the body is still self-sufficient.
  - **Empty-state.** The page renders even when both resources and travelers are empty so operators can seed the per-departure resource block before any bookings exist.
  - `DropColumn` renamed to `AllocationColumn` (now a passive layout primitive); `TravelerTile` strips its drag attrs.

### Patch Changes

- Updated dependencies [2316791]
  - @voyantjs/availability-react@0.51.0
  - @voyantjs/i18n@0.51.0
  - @voyantjs/ui@0.51.0

## 0.50.8

### Patch Changes

- @voyantjs/availability-react@0.50.8
- @voyantjs/i18n@0.50.8
- @voyantjs/ui@0.50.8

## 0.50.7

### Patch Changes

- @voyantjs/availability-react@0.50.7
- @voyantjs/i18n@0.50.7
- @voyantjs/ui@0.50.7

## 0.50.6

### Patch Changes

- Updated dependencies [c14f0a8]
  - @voyantjs/availability-react@0.50.6
  - @voyantjs/i18n@0.50.6
  - @voyantjs/ui@0.50.6

## 0.50.5

### Patch Changes

- @voyantjs/availability-react@0.50.5
- @voyantjs/i18n@0.50.5
- @voyantjs/ui@0.50.5

## 0.50.4

### Patch Changes

- @voyantjs/availability-react@0.50.4
- @voyantjs/i18n@0.50.4
- @voyantjs/ui@0.50.4

## 0.50.3

### Patch Changes

- @voyantjs/availability-react@0.50.3
- @voyantjs/i18n@0.50.3
- @voyantjs/ui@0.50.3

## 0.50.2

### Patch Changes

- @voyantjs/availability-react@0.50.2
- @voyantjs/i18n@0.50.2
- @voyantjs/ui@0.50.2

## 0.50.1

### Patch Changes

- @voyantjs/availability-react@0.50.1
- @voyantjs/i18n@0.50.1
- @voyantjs/ui@0.50.1

## 0.50.0

### Patch Changes

- @voyantjs/availability-react@0.50.0
- @voyantjs/i18n@0.50.0
- @voyantjs/ui@0.50.0

## 0.49.0

### Patch Changes

- @voyantjs/availability-react@0.49.0
- @voyantjs/i18n@0.49.0
- @voyantjs/ui@0.49.0

## 0.48.0

### Patch Changes

- @voyantjs/availability-react@0.48.0
- @voyantjs/i18n@0.48.0
- @voyantjs/ui@0.48.0

## 0.47.0

### Patch Changes

- @voyantjs/availability-react@0.47.0
- @voyantjs/i18n@0.47.0
- @voyantjs/ui@0.47.0

## 0.46.0

### Patch Changes

- @voyantjs/availability-react@0.46.0
- @voyantjs/i18n@0.46.0
- @voyantjs/ui@0.46.0

## 0.45.0

### Patch Changes

- @voyantjs/availability-react@0.45.0
- @voyantjs/i18n@0.45.0
- @voyantjs/ui@0.45.0

## 0.44.0

### Patch Changes

- @voyantjs/availability-react@0.44.0
- @voyantjs/i18n@0.44.0
- @voyantjs/ui@0.44.0

## 0.43.0

### Patch Changes

- @voyantjs/availability-react@0.43.0
- @voyantjs/i18n@0.43.0
- @voyantjs/ui@0.43.0

## 0.42.0

### Patch Changes

- @voyantjs/availability-react@0.42.0
- @voyantjs/i18n@0.42.0
- @voyantjs/ui@0.42.0

## 0.41.3

### Patch Changes

- @voyantjs/availability-react@0.41.3
- @voyantjs/i18n@0.41.3
- @voyantjs/ui@0.41.3

## 0.41.2

### Patch Changes

- @voyantjs/availability-react@0.41.2
- @voyantjs/i18n@0.41.2
- @voyantjs/ui@0.41.2

## 0.41.1

### Patch Changes

- @voyantjs/availability-react@0.41.1
- @voyantjs/i18n@0.41.1
- @voyantjs/ui@0.41.1

## 0.41.0

### Patch Changes

- @voyantjs/availability-react@0.41.0
- @voyantjs/i18n@0.41.0
- @voyantjs/ui@0.41.0

## 0.40.1

### Patch Changes

- 0809f47: Add SlotAllocationPage extension slots and extra tabs for consumer-owned financial summaries and pickup-point views.
  - @voyantjs/availability-react@0.40.1
  - @voyantjs/i18n@0.40.1
  - @voyantjs/ui@0.40.1

## 0.40.0

### Patch Changes

- @voyantjs/availability-react@0.40.0
- @voyantjs/i18n@0.40.0
- @voyantjs/ui@0.40.0

## 0.39.0

### Patch Changes

- Updated dependencies [f4235ea]
  - @voyantjs/availability-react@0.39.0
  - @voyantjs/i18n@0.39.0
  - @voyantjs/ui@0.39.0

## 0.38.2

### Patch Changes

- @voyantjs/availability-react@0.38.2
- @voyantjs/i18n@0.38.2
- @voyantjs/ui@0.38.2

## 0.38.1

### Patch Changes

- @voyantjs/availability-react@0.38.1
- @voyantjs/i18n@0.38.1
- @voyantjs/ui@0.38.1

## 0.38.0

### Patch Changes

- @voyantjs/availability-react@0.38.0
- @voyantjs/i18n@0.38.0
- @voyantjs/ui@0.38.0

## 0.37.1

### Patch Changes

- @voyantjs/availability-react@0.37.1
- @voyantjs/i18n@0.37.1
- @voyantjs/ui@0.37.1

## 0.37.0

### Minor Changes

- e0932ff: Ship a generic slot allocation surface with resource-kind tabs, vehicle seat maps, kind-aware automation actions, and allocation validation summaries.

### Patch Changes

- 0c9b884: Route remaining reusable UI literals through package i18n providers and add the UI literal scan to the shared i18n CI check.
- Updated dependencies [dc29b79]
- Updated dependencies [f014fd2]
- Updated dependencies [0c9b884]
  - @voyantjs/availability-react@0.37.0
  - @voyantjs/i18n@0.37.0
  - @voyantjs/ui@0.37.0

## 0.36.0

### Patch Changes

- @voyantjs/availability-react@0.36.0
- @voyantjs/i18n@0.36.0
- @voyantjs/ui@0.36.0

## 0.35.0

### Patch Changes

- Updated dependencies [baa6134]
  - @voyantjs/availability-react@0.35.0
  - @voyantjs/i18n@0.35.0
  - @voyantjs/ui@0.35.0

## 0.34.0

### Patch Changes

- Updated dependencies [6ad175a]
- Updated dependencies [70ee277]
- Updated dependencies [f2d4802]
  - @voyantjs/availability-react@0.34.0
  - @voyantjs/i18n@0.34.0
  - @voyantjs/ui@0.34.0
