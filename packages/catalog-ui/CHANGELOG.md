# @voyantjs/catalog-ui

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
