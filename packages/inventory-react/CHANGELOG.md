# @voyant-travel/inventory-react

## 0.14.0

### Patch Changes

- @voyant-travel/catalog-react@0.130.0
- @voyant-travel/inventory@0.4.6
- @voyant-travel/finance-react@0.132.0
- @voyant-travel/finance@0.132.0

## 0.13.2

### Patch Changes

- ba89f0b: Let admin departure edits choose and persist a product option so existing departures with a missing option can be repaired from the UI. Explicit slot option links are now validated against the slot product while product-level generated slots can still omit an option.
- Updated dependencies [ba89f0b]
  - @voyant-travel/i18n@0.107.4

## 0.13.1

### Patch Changes

- fcd2e0b: Add itinerary and day-service translation authoring surfaces, and localize owned itinerary content projection for translated days and service labels.
- Updated dependencies [fcd2e0b]
  - @voyant-travel/inventory@0.4.4

## 0.13.0

### Patch Changes

- Updated dependencies [310565b]
  - @voyant-travel/i18n@0.107.3
  - @voyant-travel/finance-react@0.131.0
  - @voyant-travel/catalog-react@0.129.0
  - @voyant-travel/finance@0.131.0
  - @voyant-travel/inventory@0.4.3

## 0.12.0

### Patch Changes

- Updated dependencies [dbea53e]
  - @voyant-travel/i18n@0.107.2
  - @voyant-travel/finance-react@0.130.0
  - @voyant-travel/catalog-react@0.128.0
  - @voyant-travel/finance@0.130.0
  - @voyant-travel/inventory@0.4.2

## 0.11.0

### Patch Changes

- @voyant-travel/inventory@0.4.1
- @voyant-travel/catalog-react@0.127.0
- @voyant-travel/finance-react@0.129.0
- @voyant-travel/finance@0.129.0

## 0.10.0

### Patch Changes

- Updated dependencies [9c47b00]
  - @voyant-travel/inventory@0.4.0
  - @voyant-travel/catalog-react@0.126.0
  - @voyant-travel/finance-react@0.128.0
  - @voyant-travel/finance@0.128.0

## 0.9.0

### Patch Changes

- @voyant-travel/inventory@0.3.9
- @voyant-travel/finance@0.127.0
- @voyant-travel/finance-react@0.127.0
- @voyant-travel/catalog-react@0.125.0

## 0.8.0

### Patch Changes

- @voyant-travel/inventory@0.3.6
- @voyant-travel/catalog-react@0.124.0
- @voyant-travel/finance-react@0.126.0
- @voyant-travel/finance@0.126.0

## 0.7.0

### Patch Changes

- Updated dependencies [a74471e]
- Updated dependencies [a74471e]
  - @voyant-travel/i18n@0.107.0
  - @voyant-travel/ui@0.108.0
  - @voyant-travel/admin@0.114.0
  - @voyant-travel/catalog-react@0.123.0
  - @voyant-travel/finance-react@0.125.0
  - @voyant-travel/inventory@0.3.5
  - @voyant-travel/finance@0.125.0

## 0.6.0

### Patch Changes

- 4f92198: Voyant 1.0 visual refactor of the framework UI.

  - **Tokens** (`@voyant-travel/ui` `globals.css`): warm off-white paper, near-black ink, and a single hot-orange brand accent (`--brand`, new token) reserved for charts/focus/active state. Inter Tight type. Fixed brand chart palette (`--chart-1..5`). A coherent radius system: controls + their dropdowns at `rounded-sm` (4px), cards/table surfaces at `rounded-md` (6px), dialogs/sheets at `rounded-xl`.
  - **`@voyant-travel/ui` components**: new `SegmentedControl`; `Button` gains a `brand` variant; sharper, consistent radii across Button/Input/Select/Combobox/Textarea/Toggle/Tabs/Menus/Command/Card/DataTable/Badge; bordered active sidebar items (primary + sub) and inset-panel border; assorted fixes (Command search-input radius, toggle-group corners, sidebar sub-menu spacing).
  - **`@voyant-travel/admin`**: Voyant 1.0 brand logo lockup (composed mark + wordmark, collapse-to-badge); operator shell defaults to the inset sidebar layout; dashboard KPI cards, brand chart colors, and Figma-matched sidebar (bordered active item, near-black nav text, bordered user card with open-state).
  - **Domain `*-react` packages**: card surfaces normalized to the new `rounded-md` radius; flights search bar (trip-type toggle, route cards, airport dropdown) and the resources tabs aligned to the system.

- Updated dependencies [4f92198]
- Updated dependencies [4f92198]
  - @voyant-travel/finance-react@0.124.0
  - @voyant-travel/ui@0.107.0
  - @voyant-travel/admin@0.113.0
  - @voyant-travel/catalog-react@0.122.0
  - @voyant-travel/finance@0.124.0
  - @voyant-travel/inventory@0.3.4

## 0.5.0

### Patch Changes

- Updated dependencies [94890c3]
- Updated dependencies [e9d9dbb]
- Updated dependencies [cb9b04b]
  - @voyant-travel/admin@0.112.0
  - @voyant-travel/finance@0.123.0
  - @voyant-travel/catalog-react@0.121.0
  - @voyant-travel/finance-react@0.123.0
  - @voyant-travel/inventory@0.3.3

## 0.4.0

### Patch Changes

- Updated dependencies [c9de9c4]
- Updated dependencies [14f4234]
- Updated dependencies [89d4ca9]
- Updated dependencies [51dd276]
  - @voyant-travel/finance@0.122.0
  - @voyant-travel/finance-react@0.122.0
  - @voyant-travel/inventory@0.3.1
  - @voyant-travel/catalog-react@0.120.0

## 0.3.0

### Patch Changes

- Updated dependencies [13fe70b]
- Updated dependencies [13fe70b]
  - @voyant-travel/finance@0.121.0
  - @voyant-travel/inventory@0.3.0
  - @voyant-travel/finance-react@0.121.0
  - @voyant-travel/catalog-react@0.119.0

## 0.2.2

### Patch Changes

- ecec979: Improve operator bundle boundaries by adding route-local admin message provider support, exposing admin extension route helpers, keeping pending skeletons structural, and tightening Vite route ignores and vendor chunk splitting so heavy admin route dependencies stay out of the initial entry.
- Updated dependencies [ecec979]
  - @voyant-travel/admin@0.111.3
  - @voyant-travel/finance-react@0.120.2
  - @voyant-travel/finance@0.120.2

## 0.2.1

### Patch Changes

- eef1a00: Republish notification and UI consumer packages so stale beta artifacts no longer reference legacy notification package specifiers.
- Updated dependencies [eef1a00]
  - @voyant-travel/admin@0.111.2
  - @voyant-travel/catalog-react@0.118.1
  - @voyant-travel/finance-react@0.120.1
  - @voyant-travel/finance@0.120.1

## 0.2.0

### Minor Changes

- 3cc83b6: Move extras runtime and React source behind Inventory and Bookings owner
  subpaths. The old runtime and React extras package names are removed from v1;
  first-party imports use the Inventory and Bookings owner paths.
- 65b3782: Add optional Inventory package entrypoints for operated product authoring and
  Inventory React authoring UI surfaces.
- a101971: Move the main operated Product route/service/schema/runtime and React
  authoring source under Inventory owner paths. The old Products runtime package
  names are removed from the v1 workspace surface, while the operator keeps
  stable `/products` API URLs backed by Inventory.

### Patch Changes

- 3408b2a: Move availability, allocation UI, resources, ground logistics, and places source
  under Operations owner paths. The old operated-execution package names are
  removed from the v1 workspace surface while first-party runtime, React, and
  operator imports use `@voyant-travel/operations` and `@voyant-travel/operations-react`
  surfaces.
- 47fef18: Retarget first-party imports from the removed beta package names to their owner
  packages. Operated product UI now imports Inventory React, commercial UI imports
  Commerce React, supplier UI imports Distribution React, checkout UI imports
  Finance React, and operated place/availability schema references import
  Operations owner paths.
- Updated dependencies [dd71543]
- Updated dependencies [3cc83b6]
- Updated dependencies [0fa993c]
- Updated dependencies [9e970a5]
- Updated dependencies [b711b04]
- Updated dependencies [3408b2a]
- Updated dependencies [7ea516a]
- Updated dependencies [65b3782]
- Updated dependencies [a101971]
- Updated dependencies [47fef18]
- Updated dependencies [6196b3b]
  - @voyant-travel/admin@0.111.1
  - @voyant-travel/inventory@0.2.0
  - @voyant-travel/finance@0.120.0
  - @voyant-travel/finance-react@0.120.0
  - @voyant-travel/catalog-react@0.118.0
