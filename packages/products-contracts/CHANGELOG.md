# @voyantjs/products-contracts

## 0.105.0

### Minor Changes

- 921f4fc: Add a canonical board-basis contract enum and reuse it across accommodation meal plans, product options, and cruise sailings.

### Patch Changes

- Updated dependencies [921f4fc]
  - @voyantjs/catalog-contracts@0.105.0

## 0.104.1

### Patch Changes

- @voyantjs/schema-kit@0.104.1

## 0.104.0

### Patch Changes

- @voyantjs/schema-kit@0.104.0

## 0.103.0

### Patch Changes

- @voyantjs/schema-kit@0.103.0

## 0.102.0

### Patch Changes

- @voyantjs/schema-kit@0.102.0

## 0.101.2

### Patch Changes

- 577eaf5: Add in-context translations for products and itinerary days.

  - `@voyantjs/products`: add a `products.default_language_tag` column (the language the base name/description columns are written in) and a new `product_day_translations` table (per-language title/description/location) with CRUD service methods and routes under `/v1/products/:id/days/:dayId/translations`.
  - `@voyantjs/products-contracts`: validation schemas for the product default language and itinerary-day translations.
  - `@voyantjs/products-react`: `useProductDayTranslations` / `useProductDayTranslationMutation` hooks, record/response schemas, and query keys; the product record now exposes `defaultLanguageTag`.
  - `@voyantjs/schema-kit`: `product_day_translations` TypeID prefix (`pdtr`).
  - `@voyantjs/i18n`: operator labels for the content-language switcher, default language, itinerary-day sheet, and market-rule columns.

- Updated dependencies [577eaf5]
  - @voyantjs/schema-kit@0.101.2

## 0.101.1

### Patch Changes

- @voyantjs/schema-kit@0.101.1

## 0.101.0

### Minor Changes

- 8e7b56a: Extract products validation into the pure `@voyantjs/products-contracts` package
  and complete the products admin SDK surface.

  - **products-contracts:** now owns the products validation cluster
    (`validation`, `validation-core`, `validation-public`, `validation-shared`,
    `validation-config`, `validation-content`, `validation-catalog`), moved out of
    the runtime `@voyantjs/products` package. Its only external imports — the two
    `@voyantjs/db` helpers — are repointed to `@voyantjs/schema-kit`, so the
    package stays zero-runtime (zod + schema-kit). Mirrors the
    bookings/finance/crm/legal split.
  - **products:** the moved files become one-line re-export stubs, so every
    existing import path (`@voyantjs/products/validation`,
    `@voyantjs/products/public-validation`, and internal `./validation-*`) keeps
    working unchanged.
  - **admin-contracts:** products gains its write descriptors —
    `products.create`/`update`/`delete` deriving from `insertProductSchema`/
    `updateProductSchema`, and `products.list` now derives from
    `productListQuerySchema` — all from the newly-pure `@voyantjs/products-contracts`.
  - **admin-client:** typed `products.create`/`update`/`delete` methods.

### Patch Changes

- @voyantjs/schema-kit@0.101.0

## 0.100.0

## 0.99.0

## 0.98.0

## 0.97.0

## 0.96.0

### Minor Changes

- 465fb31: Extend the lightweight contract-package pattern to the remaining content
  verticals.

  `@voyantjs/accommodations-contracts`, `@voyantjs/products-contracts`,
  `@voyantjs/extras-contracts`, and `@voyantjs/charters-contracts` now own their
  respective `<vertical>/v1` rich content schema, version constant, types, and
  validator as zod-only packages, so external consumers (Voyant Connect, adapter
  authors, the Admin API SDK) can validate content payloads without installing the
  framework runtime.

  The runtime `@voyantjs/accommodations`, `@voyantjs/products`,
  `@voyantjs/extras`, and `@voyantjs/charters` packages re-export their content
  shape from the matching contract package, so existing
  `@voyantjs/<vertical>/content-shape` import paths are unchanged. The
  `mergeOverlaysInto<Vertical>Content` overlay composition stays in the runtime
  package.

  See `docs/adr/0002-contract-packages.md` for the codified pattern.
