---
"@voyantjs/availability-ui": patch
"@voyantjs/availability-react": patch
"@voyantjs/resources-ui": patch
"@voyantjs/i18n": patch
---

Let templates lift the search + filter row out of the overview cards and into the page header (matching the rest of the operator shell), and accept a per-tab toolbar slot.

`@voyantjs/availability-ui`:

- `<AvailabilityOverview />` accepts `showFilters?: boolean` (default `true`). When `false`, the inline search input + product filter + clear-filters button row is hidden so the consuming page can render the same controls in its own header without duplication. KPI cards and the rest of the overview still render unchanged.
- `<AvailabilitySlotsTab />`, `<AvailabilityRulesTab />`, `<AvailabilityStartTimesTab />`, `<AvailabilityCloseoutsTab />`, `<AvailabilityPickupPointsTab />` each accept an optional `toolbar?: ReactNode` rendered between the selection action bar and the data table — for tab-scoped filter chips, pickers, etc.

`@voyantjs/availability-react`:

- `ProductListFilters` now accepts an optional `search` string, threaded through `getProductsQueryOptions` as a `?search=` query-string parameter so product pickers can autocomplete server-side.

`@voyantjs/resources-ui`:

- `<ResourcesOverview />` accepts `showFilters?: boolean` (default `true`) with the same semantics as the availability overview — hides the inline search + kind-filter row when the consuming page surfaces those controls in its header.

`@voyantjs/i18n`:

- Admin resources messages add `filtersButton`, `filtersKindLabel`, `filtersSupplierLabel` / `filtersSupplierAny` / `filtersSupplierEmpty`, `filtersProductLabel` / `filtersProductAny` / `filtersProductEmpty` (en + ro) for the new header-level filter popover.
