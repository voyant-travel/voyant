# @voyant-travel/operations-react

## 0.7.0

### Patch Changes

- @voyant-travel/bookings-react@0.126.0
- @voyant-travel/inventory-react@0.8.0
- @voyant-travel/operations@0.1.6

## 0.6.0

### Patch Changes

- Updated dependencies [a74471e]
- Updated dependencies [a74471e]
  - @voyant-travel/i18n@0.107.0
  - @voyant-travel/ui@0.108.0
  - @voyant-travel/admin@0.114.0
  - @voyant-travel/bookings-react@0.125.0
  - @voyant-travel/inventory-react@0.7.0
  - @voyant-travel/operations@0.1.5

## 0.5.0

### Patch Changes

- 4f92198: Voyant 1.0 visual refactor of the framework UI.

  - **Tokens** (`@voyant-travel/ui` `globals.css`): warm off-white paper, near-black ink, and a single hot-orange brand accent (`--brand`, new token) reserved for charts/focus/active state. Inter Tight type. Fixed brand chart palette (`--chart-1..5`). A coherent radius system: controls + their dropdowns at `rounded-sm` (4px), cards/table surfaces at `rounded-md` (6px), dialogs/sheets at `rounded-xl`.
  - **`@voyant-travel/ui` components**: new `SegmentedControl`; `Button` gains a `brand` variant; sharper, consistent radii across Button/Input/Select/Combobox/Textarea/Toggle/Tabs/Menus/Command/Card/DataTable/Badge; bordered active sidebar items (primary + sub) and inset-panel border; assorted fixes (Command search-input radius, toggle-group corners, sidebar sub-menu spacing).
  - **`@voyant-travel/admin`**: Voyant 1.0 brand logo lockup (composed mark + wordmark, collapse-to-badge); operator shell defaults to the inset sidebar layout; dashboard KPI cards, brand chart colors, and Figma-matched sidebar (bordered active item, near-black nav text, bordered user card with open-state).
  - **Domain `*-react` packages**: card surfaces normalized to the new `rounded-md` radius; flights search bar (trip-type toggle, route cards, airport dropdown) and the resources tabs aligned to the system.

- Updated dependencies [4f92198]
  - @voyant-travel/ui@0.107.0
  - @voyant-travel/admin@0.113.0
  - @voyant-travel/inventory-react@0.6.0
  - @voyant-travel/bookings-react@0.124.0
  - @voyant-travel/operations@0.1.4

## 0.4.0

### Patch Changes

- Updated dependencies [94890c3]
- Updated dependencies [cb9b04b]
  - @voyant-travel/admin@0.112.0
  - @voyant-travel/bookings-react@0.123.0
  - @voyant-travel/inventory-react@0.5.0
  - @voyant-travel/operations@0.1.3

## 0.3.0

### Patch Changes

- @voyant-travel/inventory-react@0.4.0
- @voyant-travel/bookings-react@0.122.0
- @voyant-travel/operations@0.1.2

## 0.2.0

### Patch Changes

- @voyant-travel/operations@0.1.1
- @voyant-travel/inventory-react@0.3.0
- @voyant-travel/bookings-react@0.121.0

## 0.1.2

### Patch Changes

- ecec979: Improve operator bundle boundaries by adding route-local admin message provider support, exposing admin extension route helpers, keeping pending skeletons structural, and tightening Vite route ignores and vendor chunk splitting so heavy admin route dependencies stay out of the initial entry.
- Updated dependencies [ecec979]
  - @voyant-travel/admin@0.111.3
  - @voyant-travel/bookings-react@0.120.3
  - @voyant-travel/inventory-react@0.2.2

## 0.1.1

### Patch Changes

- eef1a00: Republish notification and UI consumer packages so stale beta artifacts no longer reference legacy notification package specifiers.
- Updated dependencies [eef1a00]
  - @voyant-travel/admin@0.111.2
  - @voyant-travel/bookings-react@0.120.1
  - @voyant-travel/inventory-react@0.2.1

## 0.1.0

### Minor Changes

- 3408b2a: Move availability, allocation UI, resources, ground logistics, and places source
  under Operations owner paths. The old operated-execution package names are
  removed from the v1 workspace surface while first-party runtime, React, and
  operator imports use `@voyant-travel/operations` and `@voyant-travel/operations-react`
  surfaces.

### Patch Changes

- 47fef18: Retarget first-party imports from the removed beta package names to their owner
  packages. Operated product UI now imports Inventory React, commercial UI imports
  Commerce React, supplier UI imports Distribution React, checkout UI imports
  Finance React, and operated place/availability schema references import
  Operations owner paths.
- Updated dependencies [dd71543]
- Updated dependencies [eb17d3d]
- Updated dependencies [3cc83b6]
- Updated dependencies [44c3875]
- Updated dependencies [3408b2a]
- Updated dependencies [65b3782]
- Updated dependencies [a101971]
- Updated dependencies [47fef18]
  - @voyant-travel/admin@0.111.1
  - @voyant-travel/operations@0.1.0
  - @voyant-travel/inventory-react@0.2.0
  - @voyant-travel/bookings-react@0.120.0
