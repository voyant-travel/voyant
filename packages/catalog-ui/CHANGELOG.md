# @voyantjs/catalog-ui

## 0.52.2

### Patch Changes

- 3e09123: Rebuild the catalog detail sheet and the underlying product content/policy plumbing.

  - `CatalogDetailSheet` is reorganized into stacked sections (header, gallery, itinerary, services, policies, sourced content) with proper loading and empty states; the search and grid pages share the new sheet.
  - New itinerary section on the product detail surface (in template + catalog) so day-by-day plans render the same way in catalog browsing and operator editing.
  - `@voyantjs/products`: introduce `catalog-policy` + `content-shape` modules to centralize how cancellation/booking policies and content blocks are resolved on the catalog plane. `service-catalog-plane` and `service-content-owned` now consume these instead of inlining policy logic per call site.
  - Catalog i18n strings added for itinerary, services, and policy sections (EN + RO).
  - Operator template: drop `product-sourced-content-section` (now provided by the catalog detail sheet) and update the product detail page to render the new sections.

- Updated dependencies [3e09123]
- Updated dependencies [6bdfcbc]
- Updated dependencies [3e09123]
  - @voyantjs/catalog-react@0.52.2
  - @voyantjs/i18n@0.52.2
  - @voyantjs/ui@0.52.2

## 0.52.1

### Patch Changes

- @voyantjs/catalog-react@0.52.1
- @voyantjs/i18n@0.52.1
- @voyantjs/ui@0.52.1

## 0.52.0

### Patch Changes

- @voyantjs/catalog-react@0.52.0
- @voyantjs/i18n@0.52.0
- @voyantjs/ui@0.52.0

## 0.51.1

### Patch Changes

- Updated dependencies [deaacb3]
  - @voyantjs/catalog-react@0.51.1
  - @voyantjs/i18n@0.51.1
  - @voyantjs/ui@0.51.1

## 0.51.0

### Patch Changes

- Updated dependencies [2316791]
  - @voyantjs/catalog-react@0.51.0
  - @voyantjs/i18n@0.51.0
  - @voyantjs/ui@0.51.0

## 0.50.8

### Patch Changes

- @voyantjs/catalog-react@0.50.8
- @voyantjs/i18n@0.50.8
- @voyantjs/ui@0.50.8

## 0.50.7

### Patch Changes

- @voyantjs/catalog-react@0.50.7
- @voyantjs/i18n@0.50.7
- @voyantjs/ui@0.50.7

## 0.50.6

### Patch Changes

- Updated dependencies [c14f0a8]
  - @voyantjs/catalog-react@0.50.6
  - @voyantjs/i18n@0.50.6
  - @voyantjs/ui@0.50.6

## 0.50.5

### Patch Changes

- @voyantjs/catalog-react@0.50.5
- @voyantjs/i18n@0.50.5
- @voyantjs/ui@0.50.5

## 0.50.4

### Patch Changes

- @voyantjs/catalog-react@0.50.4
- @voyantjs/i18n@0.50.4
- @voyantjs/ui@0.50.4

## 0.50.3

### Patch Changes

- @voyantjs/catalog-react@0.50.3
- @voyantjs/i18n@0.50.3
- @voyantjs/ui@0.50.3

## 0.50.2

### Patch Changes

- @voyantjs/catalog-react@0.50.2
- @voyantjs/i18n@0.50.2
- @voyantjs/ui@0.50.2

## 0.50.1

### Patch Changes

- @voyantjs/catalog-react@0.50.1
- @voyantjs/i18n@0.50.1
- @voyantjs/ui@0.50.1

## 0.50.0

### Patch Changes

- @voyantjs/catalog-react@0.50.0
- @voyantjs/i18n@0.50.0
- @voyantjs/ui@0.50.0

## 0.49.0

### Patch Changes

- @voyantjs/catalog-react@0.49.0
- @voyantjs/i18n@0.49.0
- @voyantjs/ui@0.49.0

## 0.48.0

### Patch Changes

- @voyantjs/catalog-react@0.48.0
- @voyantjs/i18n@0.48.0
- @voyantjs/ui@0.48.0

## 0.47.0

### Patch Changes

- @voyantjs/catalog-react@0.47.0
- @voyantjs/i18n@0.47.0
- @voyantjs/ui@0.47.0

## 0.46.0

### Patch Changes

- @voyantjs/catalog-react@0.46.0
- @voyantjs/i18n@0.46.0
- @voyantjs/ui@0.46.0

## 0.45.0

### Patch Changes

- @voyantjs/catalog-react@0.45.0
- @voyantjs/i18n@0.45.0
- @voyantjs/ui@0.45.0

## 0.44.0

### Patch Changes

- @voyantjs/catalog-react@0.44.0
- @voyantjs/i18n@0.44.0
- @voyantjs/ui@0.44.0

## 0.43.0

### Patch Changes

- @voyantjs/catalog-react@0.43.0
- @voyantjs/i18n@0.43.0
- @voyantjs/ui@0.43.0

## 0.42.0

### Patch Changes

- @voyantjs/catalog-react@0.42.0
- @voyantjs/i18n@0.42.0
- @voyantjs/ui@0.42.0

## 0.41.3

### Patch Changes

- @voyantjs/catalog-react@0.41.3
- @voyantjs/i18n@0.41.3
- @voyantjs/ui@0.41.3

## 0.41.2

### Patch Changes

- @voyantjs/catalog-react@0.41.2
- @voyantjs/i18n@0.41.2
- @voyantjs/ui@0.41.2

## 0.41.1

### Patch Changes

- @voyantjs/catalog-react@0.41.1
- @voyantjs/i18n@0.41.1
- @voyantjs/ui@0.41.1

## 0.41.0

### Patch Changes

- @voyantjs/catalog-react@0.41.0
- @voyantjs/i18n@0.41.0
- @voyantjs/ui@0.41.0

## 0.40.1

### Patch Changes

- @voyantjs/catalog-react@0.40.1
- @voyantjs/i18n@0.40.1
- @voyantjs/ui@0.40.1

## 0.40.0

### Patch Changes

- @voyantjs/catalog-react@0.40.0
- @voyantjs/i18n@0.40.0
- @voyantjs/ui@0.40.0

## 0.39.0

### Patch Changes

- Updated dependencies [f4235ea]
  - @voyantjs/catalog-react@0.39.0
  - @voyantjs/i18n@0.39.0
  - @voyantjs/ui@0.39.0

## 0.38.2

### Patch Changes

- @voyantjs/catalog-react@0.38.2
- @voyantjs/i18n@0.38.2
- @voyantjs/ui@0.38.2

## 0.38.1

### Patch Changes

- @voyantjs/catalog-react@0.38.1
- @voyantjs/i18n@0.38.1
- @voyantjs/ui@0.38.1

## 0.38.0

### Patch Changes

- @voyantjs/catalog-react@0.38.0
- @voyantjs/i18n@0.38.0
- @voyantjs/ui@0.38.0

## 0.37.1

### Patch Changes

- @voyantjs/catalog-react@0.37.1
- @voyantjs/i18n@0.37.1
- @voyantjs/ui@0.37.1

## 0.37.0

### Patch Changes

- 0c9b884: Route remaining reusable UI literals through package i18n providers and add the UI literal scan to the shared i18n CI check.
- e5ce6a0: Route remaining shared UI literals through package i18n providers.
- Updated dependencies [dc29b79]
- Updated dependencies [f014fd2]
- Updated dependencies [0c9b884]
  - @voyantjs/catalog-react@0.37.0
  - @voyantjs/i18n@0.37.0
  - @voyantjs/ui@0.37.0

## 0.36.0

### Patch Changes

- @voyantjs/catalog-react@0.36.0
- @voyantjs/i18n@0.36.0
- @voyantjs/ui@0.36.0

## 0.35.0

### Patch Changes

- Updated dependencies [baa6134]
  - @voyantjs/catalog-react@0.35.0
  - @voyantjs/i18n@0.35.0
  - @voyantjs/ui@0.35.0

## 0.34.0

### Minor Changes

- 9eda036: Widen `CatalogDetailSheet` by default and add detail extension slots for header actions, brochure content, custom media rendering, custom itinerary day rendering, and extra consumer sections.

### Patch Changes

- Updated dependencies [6ad175a]
- Updated dependencies [70ee277]
- Updated dependencies [f2d4802]
  - @voyantjs/catalog-react@0.34.0
  - @voyantjs/i18n@0.34.0
  - @voyantjs/ui@0.34.0

## 0.33.1

### Patch Changes

- @voyantjs/catalog-react@0.33.1
- @voyantjs/i18n@0.33.1
- @voyantjs/ui@0.33.1

## 0.33.0

### Patch Changes

- Updated dependencies [db46afc]
  - @voyantjs/catalog-react@0.33.0
  - @voyantjs/i18n@0.33.0
  - @voyantjs/ui@0.33.0

## 0.32.3

### Patch Changes

- Updated dependencies [7632a66]
  - @voyantjs/catalog-react@0.32.3
  - @voyantjs/i18n@0.32.3
  - @voyantjs/ui@0.32.3

## 0.32.2

### Patch Changes

- @voyantjs/catalog-react@0.32.2
- @voyantjs/i18n@0.32.2
- @voyantjs/ui@0.32.2

## 0.32.1

### Patch Changes

- @voyantjs/catalog-react@0.32.1
- @voyantjs/i18n@0.32.1
- @voyantjs/ui@0.32.1

## 0.32.0

### Patch Changes

- @voyantjs/catalog-react@0.32.0
- @voyantjs/i18n@0.32.0
- @voyantjs/ui@0.32.0

## 0.31.4

### Patch Changes

- @voyantjs/catalog-react@0.31.4
- @voyantjs/i18n@0.31.4
- @voyantjs/ui@0.31.4

## 0.31.3

### Patch Changes

- @voyantjs/catalog-react@0.31.3
- @voyantjs/i18n@0.31.3
- @voyantjs/ui@0.31.3

## 0.31.2

### Patch Changes

- Updated dependencies [54ddc93]
  - @voyantjs/catalog-react@0.31.2
  - @voyantjs/i18n@0.31.2
  - @voyantjs/ui@0.31.2

## 0.31.1

### Patch Changes

- Updated dependencies [00f7c4f]
  - @voyantjs/catalog-react@0.31.1
  - @voyantjs/i18n@0.31.1
  - @voyantjs/ui@0.31.1

## 0.31.0

### Minor Changes

- ee75afb: Publish catalog search and booking page compositions with explicit routing,
  fetcher, contact picker, and booking integration extension points.

### Patch Changes

- @voyantjs/catalog-react@0.31.0
- @voyantjs/i18n@0.31.0
- @voyantjs/ui@0.31.0

## 0.30.7

### Patch Changes

- @voyantjs/catalog-react@0.30.7
- @voyantjs/ui@0.30.7

## 0.30.6

### Patch Changes

- @voyantjs/catalog-react@0.30.6
- @voyantjs/ui@0.30.6

## 0.30.5

### Patch Changes

- @voyantjs/catalog-react@0.30.5
- @voyantjs/ui@0.30.5

## 0.30.4

### Patch Changes

- @voyantjs/catalog-react@0.30.4
- @voyantjs/ui@0.30.4

## 0.30.3

### Patch Changes

- @voyantjs/catalog-react@0.30.3
- @voyantjs/ui@0.30.3

## 0.30.2

### Patch Changes

- @voyantjs/catalog-react@0.30.2
- @voyantjs/ui@0.30.2

## 0.30.1

### Patch Changes

- @voyantjs/catalog-react@0.30.1
- @voyantjs/ui@0.30.1

## 0.30.0

### Patch Changes

- @voyantjs/catalog-react@0.30.0
- @voyantjs/ui@0.30.0

## 0.29.0

### Patch Changes

- Updated dependencies [583326e]
- Updated dependencies [4a6523e]
- Updated dependencies [4a6523e]
- Updated dependencies [4a6523e]
  - @voyantjs/catalog-react@0.29.0
  - @voyantjs/ui@0.29.0

## 0.28.3

### Patch Changes

- Updated dependencies [60ef432]
  - @voyantjs/catalog-react@0.28.3
  - @voyantjs/ui@0.28.3

## 0.28.2

### Patch Changes

- @voyantjs/catalog-react@0.28.2
- @voyantjs/ui@0.28.2

## 0.28.1

### Patch Changes

- Updated dependencies [9d88eae]
  - @voyantjs/catalog-react@0.28.1
  - @voyantjs/ui@0.28.1

## 0.28.0

### Patch Changes

- @voyantjs/catalog-react@0.28.0
- @voyantjs/ui@0.28.0

## 0.27.0

### Patch Changes

- @voyantjs/catalog-react@0.27.0
- @voyantjs/ui@0.27.0

## 0.26.9

### Patch Changes

- @voyantjs/catalog-react@0.26.9
- @voyantjs/ui@0.26.9

## 0.26.8

### Patch Changes

- abc9aa0: Fall back to `product.sellCurrency` when `price_catalogs.currencyCode` is null in the public pricing snapshot, and stop silently labelling currency-less amounts as EUR.

  - `@voyantjs/pricing`: `getProductPricingSnapshot` now resolves the snapshot's `catalog.currencyCode` from the catalog when set, otherwise from the product's `sellCurrency`. Catalogs with a non-null `currencyCode` behave exactly as before; catalogs with `currency_code = NULL` follow each product's native currency, so multi-currency operators can use a single retail catalog instead of one catalog per currency.
  - `@voyantjs/catalog-ui`: `formatPriceCents` in the catalog detail sheet now renders plain digits (no currency symbol) when no currency is supplied, instead of mis-labelling amounts as EUR.
  - `@voyantjs/bookings-ui`: `formatMoney` in the booking payments summary handles a missing currency the same way.
  - @voyantjs/catalog-react@0.26.8
  - @voyantjs/ui@0.26.8

## 0.26.7

### Patch Changes

- @voyantjs/catalog-react@0.26.7
- @voyantjs/ui@0.26.7

## 0.26.6

### Patch Changes

- @voyantjs/catalog-react@0.26.6
- @voyantjs/ui@0.26.6

## 0.26.5

### Patch Changes

- @voyantjs/catalog-react@0.26.5
- @voyantjs/ui@0.26.5

## 0.26.4

### Patch Changes

- @voyantjs/catalog-react@0.26.4
- @voyantjs/ui@0.26.4

## 0.26.3

### Patch Changes

- @voyantjs/catalog-react@0.26.3
- @voyantjs/ui@0.26.3

## 0.26.2

### Patch Changes

- @voyantjs/catalog-react@0.26.2
- @voyantjs/ui@0.26.2

## 0.26.1

### Patch Changes

- @voyantjs/catalog-react@0.26.1
- @voyantjs/ui@0.26.1

## 0.26.0

### Patch Changes

- @voyantjs/catalog-react@0.26.0
- @voyantjs/ui@0.26.0

## 0.25.0

### Patch Changes

- @voyantjs/catalog-react@0.25.0
- @voyantjs/ui@0.25.0

## 0.24.3

### Patch Changes

- @voyantjs/catalog-react@0.24.3
- @voyantjs/ui@0.24.3

## 0.24.2

### Patch Changes

- @voyantjs/catalog-react@0.24.2
- @voyantjs/ui@0.24.2

## 0.24.1

### Patch Changes

- Updated dependencies [ed635c7]
  - @voyantjs/catalog-react@0.24.1
  - @voyantjs/ui@0.24.1

## 0.24.0

### Patch Changes

- @voyantjs/catalog-react@0.24.0
- @voyantjs/ui@0.24.0

## 0.23.0

### Patch Changes

- @voyantjs/catalog-react@0.23.0
- @voyantjs/ui@0.23.0

## 0.22.0

### Patch Changes

- @voyantjs/catalog-react@0.22.0
- @voyantjs/ui@0.22.0

## 0.21.1

### Patch Changes

- @voyantjs/catalog-react@0.21.1
- @voyantjs/ui@0.21.1

## 0.21.0

### Patch Changes

- Updated dependencies [6427bad]
  - @voyantjs/catalog-react@0.21.0
  - @voyantjs/ui@0.21.0

## 0.20.0

### Patch Changes

- @voyantjs/catalog-react@0.20.0
- @voyantjs/ui@0.20.0
