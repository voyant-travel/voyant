---
"@voyantjs/facilities-ui": minor
---

New package `@voyantjs/facilities-ui` shipping React UI primitives for picking facilities by ID. Sibling to `@voyantjs/facilities-react`, follows the same shape as `@voyantjs/products-ui`'s entity comboboxes:

- `<FacilityCombobox kind?="port" value onChange />` — debounced search backed by `useFacilities({ search, kind, limit })`.
- `<FacilityBadge facilityId label? />` — read-only display chip; pass `label` to skip the `useFacility` lookup when the parent record already carries a denormalized name.

Includes `FacilitiesUiMessagesProvider` for locale-aware copy and an English/Romanian message parity test.
