# @voyant-travel/commerce-react

## 0.14.0

### Patch Changes

- @voyant-travel/commerce@0.14.0
- @voyant-travel/distribution-react@0.122.0
- @voyant-travel/inventory-react@0.14.0

## 0.13.0

### Patch Changes

- Updated dependencies [310565b]
  - @voyant-travel/i18n@0.107.3
  - @voyant-travel/distribution-react@0.121.0
  - @voyant-travel/inventory-react@0.13.0
  - @voyant-travel/commerce@0.13.0

## 0.12.0

### Patch Changes

- Updated dependencies [dbea53e]
  - @voyant-travel/i18n@0.107.2
  - @voyant-travel/distribution-react@0.120.0
  - @voyant-travel/inventory-react@0.12.0
  - @voyant-travel/commerce@0.12.0

## 0.11.0

### Patch Changes

- @voyant-travel/commerce@0.11.0
- @voyant-travel/distribution-react@0.119.0
- @voyant-travel/inventory-react@0.11.0

## 0.10.0

### Patch Changes

- @voyant-travel/inventory-react@0.10.0
- @voyant-travel/distribution-react@0.118.0
- @voyant-travel/commerce@0.10.0

## 0.9.0

### Patch Changes

- @voyant-travel/commerce@0.9.0
- @voyant-travel/distribution-react@0.117.0
- @voyant-travel/inventory-react@0.9.0

## 0.8.0

### Patch Changes

- @voyant-travel/commerce@0.8.0
- @voyant-travel/distribution-react@0.116.0
- @voyant-travel/inventory-react@0.8.0

## 0.7.0

### Patch Changes

- Updated dependencies [a74471e]
- Updated dependencies [a74471e]
  - @voyant-travel/i18n@0.107.0
  - @voyant-travel/ui@0.108.0
  - @voyant-travel/commerce@0.7.0
  - @voyant-travel/admin@0.114.0
  - @voyant-travel/distribution-react@0.115.0
  - @voyant-travel/inventory-react@0.7.0

## 0.6.0

### Patch Changes

- 4f92198: Voyant 1.0 visual refactor of the framework UI.

  - **Tokens** (`@voyant-travel/ui` `globals.css`): warm off-white paper, near-black ink, and a single hot-orange brand accent (`--brand`, new token) reserved for charts/focus/active state. Inter Tight type. Fixed brand chart palette (`--chart-1..5`). A coherent radius system: controls + their dropdowns at `rounded-sm` (4px), cards/table surfaces at `rounded-md` (6px), dialogs/sheets at `rounded-xl`.
  - **`@voyant-travel/ui` components**: new `SegmentedControl`; `Button` gains a `brand` variant; sharper, consistent radii across Button/Input/Select/Combobox/Textarea/Toggle/Tabs/Menus/Command/Card/DataTable/Badge; bordered active sidebar items (primary + sub) and inset-panel border; assorted fixes (Command search-input radius, toggle-group corners, sidebar sub-menu spacing).
  - **`@voyant-travel/admin`**: Voyant 1.0 brand logo lockup (composed mark + wordmark, collapse-to-badge); operator shell defaults to the inset sidebar layout; dashboard KPI cards, brand chart colors, and Figma-matched sidebar (bordered active item, near-black nav text, bordered user card with open-state).
  - **Domain `*-react` packages**: card surfaces normalized to the new `rounded-md` radius; flights search bar (trip-type toggle, route cards, airport dropdown) and the resources tabs aligned to the system.

- Updated dependencies [4f92198]
  - @voyant-travel/ui@0.107.0
  - @voyant-travel/admin@0.113.0
  - @voyant-travel/distribution-react@0.114.0
  - @voyant-travel/inventory-react@0.6.0
  - @voyant-travel/commerce@0.6.0

## 0.5.0

### Patch Changes

- Updated dependencies [94890c3]
- Updated dependencies [cb9b04b]
  - @voyant-travel/admin@0.112.0
  - @voyant-travel/distribution-react@0.113.0
  - @voyant-travel/inventory-react@0.5.0
  - @voyant-travel/commerce@0.5.0

## 0.4.0

### Patch Changes

- @voyant-travel/commerce@0.4.0
- @voyant-travel/inventory-react@0.4.0
- @voyant-travel/distribution-react@0.112.0

## 0.3.0

### Patch Changes

- Updated dependencies [13fe70b]
  - @voyant-travel/commerce@0.3.0
  - @voyant-travel/inventory-react@0.3.0
  - @voyant-travel/distribution-react@0.111.0

## 0.2.1

### Patch Changes

- eef1a00: Republish notification and UI consumer packages so stale beta artifacts no longer reference legacy notification package specifiers.
- Updated dependencies [eef1a00]
  - @voyant-travel/admin@0.111.2
  - @voyant-travel/distribution-react@0.110.4
  - @voyant-travel/inventory-react@0.2.1

## 0.2.0

### Minor Changes

- 97d520c: Add the Commerce React owner package and retarget first-party UI wiring to the
  Commerce owner path.
- 85f9ce1: Move commercial React/admin source under the Commerce React owner path and
  remove the old Markets, Pricing, Promotions, and Sellability React package
  names from the v1 workspace surface.

### Patch Changes

- 47fef18: Retarget first-party imports from the removed beta package names to their owner
  packages. Operated product UI now imports Inventory React, commercial UI imports
  Commerce React, supplier UI imports Distribution React, checkout UI imports
  Finance React, and operated place/availability schema references import
  Operations owner paths.
- Updated dependencies [dd71543]
- Updated dependencies [e388bc9]
- Updated dependencies [6bff46f]
- Updated dependencies [a4e0909]
- Updated dependencies [eb17d3d]
- Updated dependencies [3cc83b6]
- Updated dependencies [3408b2a]
- Updated dependencies [3e160d3]
- Updated dependencies [65b3782]
- Updated dependencies [a101971]
- Updated dependencies [47fef18]
- Updated dependencies [063f2b5]
  - @voyant-travel/admin@0.111.1
  - @voyant-travel/commerce@0.2.0
  - @voyant-travel/inventory-react@0.2.0
  - @voyant-travel/distribution-react@0.110.0
