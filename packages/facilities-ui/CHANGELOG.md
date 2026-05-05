# @voyantjs/facilities-ui

## 0.24.0

### Patch Changes

- @voyantjs/facilities-react@0.24.0
- @voyantjs/i18n@0.24.0
- @voyantjs/ui@0.24.0

## 0.23.0

### Patch Changes

- @voyantjs/facilities-react@0.23.0
- @voyantjs/i18n@0.23.0
- @voyantjs/ui@0.23.0

## 0.22.0

### Patch Changes

- @voyantjs/facilities-react@0.22.0
- @voyantjs/i18n@0.22.0
- @voyantjs/ui@0.22.0

## 0.21.1

### Patch Changes

- @voyantjs/facilities-react@0.21.1
- @voyantjs/i18n@0.21.1
- @voyantjs/ui@0.21.1

## 0.21.0

### Patch Changes

- Updated dependencies [6427bad]
  - @voyantjs/facilities-react@0.21.0
  - @voyantjs/i18n@0.21.0
  - @voyantjs/ui@0.21.0

## 0.20.0

### Patch Changes

- @voyantjs/facilities-react@0.20.0
- @voyantjs/i18n@0.20.0
- @voyantjs/ui@0.20.0

## 0.19.0

### Patch Changes

- @voyantjs/facilities-react@0.19.0
- @voyantjs/i18n@0.19.0
- @voyantjs/ui@0.19.0

## 0.18.0

### Patch Changes

- @voyantjs/facilities-react@0.18.0
- @voyantjs/i18n@0.18.0
- @voyantjs/ui@0.18.0

## 0.17.0

### Minor Changes

- 66d722d: New package `@voyantjs/facilities-ui` shipping React UI primitives for picking facilities by ID. Sibling to `@voyantjs/facilities-react`, follows the same shape as `@voyantjs/products-ui`'s entity comboboxes:

  - `<FacilityCombobox kind?="port" value onChange />` — debounced search backed by `useFacilities({ search, kind, limit })`.
  - `<FacilityBadge facilityId label? />` — read-only display chip; pass `label` to skip the `useFacility` lookup when the parent record already carries a denormalized name.

  Includes `FacilitiesUiMessagesProvider` for locale-aware copy and an English/Romanian message parity test.

### Patch Changes

- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
  - @voyantjs/facilities-react@0.17.0
  - @voyantjs/i18n@0.17.0
  - @voyantjs/ui@0.17.0
