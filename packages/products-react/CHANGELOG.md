# @voyantjs/products-react

## 0.119.2

### Patch Changes

- Updated dependencies [3f52991]
- Updated dependencies [d097ac1]
  - @voyantjs/finance@0.119.2
  - @voyantjs/products@0.119.2
  - @voyantjs/finance-react@0.119.2

## 0.119.1

### Patch Changes

- @voyantjs/availability@0.116.1
- @voyantjs/finance@0.119.1
- @voyantjs/products@0.119.1
- @voyantjs/availability-react@0.116.1
- @voyantjs/catalog-react@0.117.1
- @voyantjs/extras-react@0.119.1
- @voyantjs/finance-react@0.119.1
- @voyantjs/markets-react@0.107.5
- @voyantjs/pricing-react@0.119.1
- @voyantjs/suppliers-react@0.111.6

## 0.119.0

### Patch Changes

- Updated dependencies [b0f1e21]
  - @voyantjs/utils@0.105.0
  - @voyantjs/availability@0.116.0
  - @voyantjs/finance@0.119.0
  - @voyantjs/products@0.119.0
  - @voyantjs/pricing-react@0.119.0
  - @voyantjs/ui@0.106.1
  - @voyantjs/availability-react@0.116.0
  - @voyantjs/catalog-react@0.117.0
  - @voyantjs/extras-react@0.119.0
  - @voyantjs/finance-react@0.119.0
  - @voyantjs/markets-react@0.107.4
  - @voyantjs/suppliers-react@0.111.5

## 0.118.0

### Patch Changes

- Updated dependencies [004fc38]
  - @voyantjs/products@0.118.0
  - @voyantjs/availability@0.115.0
  - @voyantjs/finance@0.118.0
  - @voyantjs/availability-react@0.115.0
  - @voyantjs/catalog-react@0.116.0
  - @voyantjs/extras-react@0.118.0
  - @voyantjs/finance-react@0.118.0
  - @voyantjs/pricing-react@0.118.0
  - @voyantjs/suppliers-react@0.111.4

## 0.117.1

### Patch Changes

- Updated dependencies [b7056f1]
  - @voyantjs/products@0.117.1
  - @voyantjs/finance@0.117.1
  - @voyantjs/availability@0.114.1
  - @voyantjs/availability-react@0.114.1
  - @voyantjs/catalog-react@0.115.1
  - @voyantjs/extras-react@0.117.1
  - @voyantjs/finance-react@0.117.1
  - @voyantjs/markets-react@0.107.3
  - @voyantjs/pricing-react@0.117.1
  - @voyantjs/suppliers-react@0.111.3

## 0.117.0

### Patch Changes

- Updated dependencies [7255353]
- Updated dependencies [7255353]
- Updated dependencies [7255353]
- Updated dependencies [7255353]
  - @voyantjs/availability@0.114.0
  - @voyantjs/finance@0.117.0
  - @voyantjs/products@0.117.0
  - @voyantjs/availability-react@0.114.0
  - @voyantjs/catalog-react@0.115.0
  - @voyantjs/extras-react@0.117.0
  - @voyantjs/finance-react@0.117.0
  - @voyantjs/markets-react@0.107.2
  - @voyantjs/pricing-react@0.117.0
  - @voyantjs/suppliers-react@0.111.2

## 0.116.0

### Patch Changes

- Updated dependencies [418fa82]
  - @voyantjs/products@0.116.0
  - @voyantjs/availability@0.113.0
  - @voyantjs/finance@0.116.0
  - @voyantjs/availability-react@0.113.0
  - @voyantjs/catalog-react@0.114.0
  - @voyantjs/extras-react@0.116.0
  - @voyantjs/finance-react@0.116.0
  - @voyantjs/pricing-react@0.116.0
  - @voyantjs/markets-react@0.107.1
  - @voyantjs/suppliers-react@0.111.1

## 0.115.0

### Minor Changes

- 6d496d0: Add the `./admin` entry: `createProductsAdminExtension` contributes the full products admin routes (list, categories, detail) per the packaged-admin RFC — lazy page hosts (`ProductsHost`, `ProductCategoriesHost`, a packaged default detail page), SSR `data-only` loaders fed by the host runtime, the `ProductsListSkeleton`/`ProductDetailSkeleton` pending components, and route-backed destination annotations (`product.list`, `product.detail`, `productCategory.list`). The detail page exposes a `detailPageComponent` substitution seam for app-owned composition (e.g. the operator passes its wrapper that adds the availability-react option resource templates panel — a dependency cycle from this package — plus its app upload route and a product-pre-selected new-booking deep link). A new `createProductDetailRestApi` builds the `ProductDetailApi` REST transport from a plain `baseUrl` + fetcher pair. No navigation contributed — Products is base-nav-owned.

### Patch Changes

- Updated dependencies [41b08db]
  - @voyantjs/admin@0.111.0
  - @voyantjs/catalog-react@0.113.0
  - @voyantjs/finance-react@0.115.0
  - @voyantjs/availability-react@0.112.0
  - @voyantjs/suppliers-react@0.111.0
  - @voyantjs/extras-react@0.115.0
  - @voyantjs/pricing-react@0.115.0
  - @voyantjs/availability@0.112.0
  - @voyantjs/finance@0.115.0
  - @voyantjs/products@0.115.0

## 0.114.0

### Patch Changes

- Updated dependencies [f7bd971]
  - @voyantjs/finance-react@0.114.0
  - @voyantjs/availability-react@0.111.0
  - @voyantjs/catalog-react@0.112.0
  - @voyantjs/extras-react@0.114.0
  - @voyantjs/pricing-react@0.114.0
  - @voyantjs/availability@0.111.0
  - @voyantjs/finance@0.114.0
  - @voyantjs/products@0.114.0
  - @voyantjs/suppliers-react@0.110.1

## 0.113.0

### Patch Changes

- @voyantjs/availability-react@0.110.0
- @voyantjs/finance-react@0.113.0
- @voyantjs/catalog-react@0.111.0
- @voyantjs/suppliers-react@0.110.0
- @voyantjs/extras-react@0.113.0
- @voyantjs/pricing-react@0.113.0
- @voyantjs/availability@0.110.0
- @voyantjs/finance@0.113.0
- @voyantjs/products@0.113.0

## 0.112.0

### Patch Changes

- Updated dependencies [279f97c]
- Updated dependencies [faec538]
  - @voyantjs/availability-react@0.109.0
  - @voyantjs/catalog-react@0.110.0
  - @voyantjs/finance-react@0.112.0
  - @voyantjs/suppliers-react@0.109.0
  - @voyantjs/extras-react@0.112.0
  - @voyantjs/pricing-react@0.112.0
  - @voyantjs/availability@0.109.0
  - @voyantjs/finance@0.112.0
  - @voyantjs/products@0.112.0

## 0.111.0

### Patch Changes

- Updated dependencies [478aa7c]
  - @voyantjs/availability-react@0.108.0
  - @voyantjs/catalog-react@0.109.0
  - @voyantjs/finance-react@0.111.0
  - @voyantjs/suppliers-react@0.108.0
  - @voyantjs/extras-react@0.111.0
  - @voyantjs/pricing-react@0.111.0
  - @voyantjs/availability@0.108.0
  - @voyantjs/finance@0.111.0
  - @voyantjs/products@0.111.0

## 0.110.0

### Minor Changes

- 6c27159: Merge each module's `*-ui` package into its `*-react` sibling (#1652). The
  `*-react` package is now the whole client tier: the headless exports (root,
  `./hooks`, `./client`, `./provider`) are unchanged, and the styled tier moves
  in under new subpaths — `./ui` (the old `*-ui` root barrel), `./components/*`,
  `./admin`, `./i18n`, `./i18n/en`, `./i18n/ro`, and `./styles.css`.

  Migration from `@voyantjs/<module>-ui`:

  - `@voyantjs/<module>-ui` → `@voyantjs/<module>-react/ui`
  - `@voyantjs/<module>-ui/<subpath>` → `@voyantjs/<module>-react/<subpath>`
  - package.json: drop the `-ui` dependency; `-react` covers both tiers.

  Styled-tier peers (`@voyantjs/ui`, `@voyantjs/admin`, `@tanstack/react-table`,
  `sonner`, `react-hook-form`, sibling `*-react` hooks packages) are optional
  peers — headless consumers that only import the root/`hooks`/`client` subpaths
  do not need them. The 27 `@voyantjs/*-ui` packages are deprecated on npm in
  favor of these subpaths; `@voyantjs/allocation-ui` and
  `@voyantjs/workflow-runs-ui` (no `-react` sibling) are unaffected.

### Patch Changes

- Updated dependencies [6c27159]
  - @voyantjs/availability-react@0.107.0
  - @voyantjs/catalog-react@0.108.0
  - @voyantjs/extras-react@0.110.0
  - @voyantjs/finance-react@0.110.0
  - @voyantjs/markets-react@0.107.0
  - @voyantjs/pricing-react@0.110.0
  - @voyantjs/suppliers-react@0.107.0
  - @voyantjs/availability@0.107.0
  - @voyantjs/finance@0.110.0
  - @voyantjs/products@0.110.0

## 0.109.0

### Patch Changes

- @voyantjs/products@0.109.0

## 0.108.1

### Patch Changes

- Updated dependencies [92af490]
  - @voyantjs/products@0.108.1

## 0.108.0

### Patch Changes

- Updated dependencies [7122c2a]
  - @voyantjs/products@0.108.0

## 0.107.1

### Patch Changes

- @voyantjs/products@0.107.1

## 0.107.0

### Patch Changes

- @voyantjs/products@0.107.0

## 0.106.0

### Patch Changes

- @voyantjs/products@0.106.0

## 0.105.0

### Patch Changes

- Updated dependencies [921f4fc]
  - @voyantjs/products@0.105.0

## 0.104.3

### Patch Changes

- Updated dependencies [5c7a075]
  - @voyantjs/products@0.104.3

## 0.104.2

### Patch Changes

- @voyantjs/products@0.104.2

## 0.104.1

### Patch Changes

- @voyantjs/products@0.104.1
- @voyantjs/react@0.104.1

## 0.104.0

### Patch Changes

- @voyantjs/products@0.104.0
- @voyantjs/react@0.104.0

## 0.103.0

### Patch Changes

- @voyantjs/products@0.103.0
- @voyantjs/react@0.103.0

## 0.102.0

### Patch Changes

- Updated dependencies [b6d0673]
  - @voyantjs/products@0.102.0
  - @voyantjs/react@0.102.0

## 0.101.2

### Patch Changes

- 577eaf5: Add in-context translations for products and itinerary days.

  - `@voyantjs/products`: add a `products.default_language_tag` column (the language the base name/description columns are written in) and a new `product_day_translations` table (per-language title/description/location) with CRUD service methods and routes under `/v1/products/:id/days/:dayId/translations`.
  - `@voyantjs/products-contracts`: validation schemas for the product default language and itinerary-day translations.
  - `@voyantjs/products-react`: `useProductDayTranslations` / `useProductDayTranslationMutation` hooks, record/response schemas, and query keys; the product record now exposes `defaultLanguageTag`.
  - `@voyantjs/schema-kit`: `product_day_translations` TypeID prefix (`pdtr`).
  - `@voyantjs/i18n`: operator labels for the content-language switcher, default language, itinerary-day sheet, and market-rule columns.

- Updated dependencies [577eaf5]
  - @voyantjs/products@0.101.2
  - @voyantjs/react@0.101.2

## 0.101.1

### Patch Changes

- @voyantjs/products@0.101.1
- @voyantjs/react@0.101.1

## 0.101.0

### Patch Changes

- Updated dependencies [8e7b56a]
  - @voyantjs/products@0.101.0
  - @voyantjs/react@0.101.0

## 0.100.0

### Patch Changes

- @voyantjs/products@0.100.0
- @voyantjs/react@0.100.0

## 0.99.0

### Patch Changes

- @voyantjs/products@0.99.0
- @voyantjs/react@0.99.0

## 0.98.0

### Patch Changes

- @voyantjs/products@0.98.0
- @voyantjs/react@0.98.0

## 0.97.0

### Patch Changes

- @voyantjs/products@0.97.0
- @voyantjs/react@0.97.0

## 0.96.0

### Patch Changes

- Updated dependencies [465fb31]
  - @voyantjs/products@0.96.0
  - @voyantjs/react@0.96.0

## 0.95.0

### Patch Changes

- @voyantjs/products@0.95.0
- @voyantjs/react@0.95.0

## 0.94.0

### Patch Changes

- @voyantjs/products@0.94.0
- @voyantjs/react@0.94.0

## 0.93.0

### Patch Changes

- Updated dependencies [5df6824]
  - @voyantjs/products@0.93.0
  - @voyantjs/react@0.93.0

## 0.92.0

### Patch Changes

- @voyantjs/products@0.92.0
- @voyantjs/react@0.92.0

## 0.91.0

### Patch Changes

- @voyantjs/products@0.91.0
- @voyantjs/react@0.91.0

## 0.90.0

### Patch Changes

- @voyantjs/products@0.90.0
- @voyantjs/react@0.90.0

## 0.89.0

### Patch Changes

- @voyantjs/products@0.89.0
- @voyantjs/react@0.89.0

## 0.88.0

### Patch Changes

- @voyantjs/products@0.88.0
- @voyantjs/react@0.88.0

## 0.87.1

### Patch Changes

- @voyantjs/products@0.87.1
- @voyantjs/react@0.87.1

## 0.87.0

### Patch Changes

- @voyantjs/products@0.87.0
- @voyantjs/react@0.87.0

## 0.86.0

### Patch Changes

- @voyantjs/products@0.86.0
- @voyantjs/react@0.86.0

## 0.85.4

### Patch Changes

- @voyantjs/products@0.85.4
- @voyantjs/react@0.85.4

## 0.85.3

### Patch Changes

- @voyantjs/products@0.85.3
- @voyantjs/react@0.85.3

## 0.85.2

### Patch Changes

- @voyantjs/products@0.85.2
- @voyantjs/react@0.85.2

## 0.85.1

### Patch Changes

- @voyantjs/products@0.85.1
- @voyantjs/react@0.85.1

## 0.85.0

### Patch Changes

- @voyantjs/products@0.85.0
- @voyantjs/react@0.85.0

## 0.84.4

### Patch Changes

- @voyantjs/products@0.84.4
- @voyantjs/react@0.84.4

## 0.84.3

### Patch Changes

- @voyantjs/products@0.84.3
- @voyantjs/react@0.84.3

## 0.84.2

### Patch Changes

- @voyantjs/products@0.84.2
- @voyantjs/react@0.84.2

## 0.84.1

### Patch Changes

- @voyantjs/products@0.84.1
- @voyantjs/react@0.84.1

## 0.84.0

### Patch Changes

- @voyantjs/products@0.84.0
- @voyantjs/react@0.84.0

## 0.83.1

### Patch Changes

- @voyantjs/products@0.83.1
- @voyantjs/react@0.83.1

## 0.83.0

### Patch Changes

- @voyantjs/products@0.83.0
- @voyantjs/react@0.83.0

## 0.82.1

### Patch Changes

- @voyantjs/products@0.82.1
- @voyantjs/react@0.82.1

## 0.82.0

### Patch Changes

- Updated dependencies [79ce168]
  - @voyantjs/products@0.82.0
  - @voyantjs/react@0.82.0

## 0.81.21

### Patch Changes

- @voyantjs/products@0.81.21
- @voyantjs/react@0.81.21

## 0.81.20

### Patch Changes

- @voyantjs/products@0.81.20
- @voyantjs/react@0.81.20

## 0.81.19

### Patch Changes

- @voyantjs/products@0.81.19
- @voyantjs/react@0.81.19

## 0.81.18

### Patch Changes

- @voyantjs/products@0.81.18
- @voyantjs/react@0.81.18

## 0.81.17

### Patch Changes

- @voyantjs/products@0.81.17
- @voyantjs/react@0.81.17

## 0.81.16

### Patch Changes

- Updated dependencies [0a617cc]
  - @voyantjs/products@0.81.16
  - @voyantjs/react@0.81.16

## 0.81.15

### Patch Changes

- @voyantjs/products@0.81.15
- @voyantjs/react@0.81.15

## 0.81.14

### Patch Changes

- @voyantjs/products@0.81.14
- @voyantjs/react@0.81.14

## 0.81.13

### Patch Changes

- @voyantjs/products@0.81.13
- @voyantjs/react@0.81.13

## 0.81.12

### Patch Changes

- @voyantjs/products@0.81.12
- @voyantjs/react@0.81.12

## 0.81.11

### Patch Changes

- @voyantjs/products@0.81.11
- @voyantjs/react@0.81.11

## 0.81.10

### Patch Changes

- @voyantjs/products@0.81.10
- @voyantjs/react@0.81.10

## 0.81.9

### Patch Changes

- @voyantjs/products@0.81.9
- @voyantjs/react@0.81.9

## 0.81.8

### Patch Changes

- @voyantjs/products@0.81.8
- @voyantjs/react@0.81.8

## 0.81.7

### Patch Changes

- @voyantjs/products@0.81.7
- @voyantjs/react@0.81.7

## 0.81.6

### Patch Changes

- @voyantjs/products@0.81.6
- @voyantjs/react@0.81.6

## 0.81.5

### Patch Changes

- @voyantjs/products@0.81.5
- @voyantjs/react@0.81.5

## 0.81.4

### Patch Changes

- @voyantjs/products@0.81.4
- @voyantjs/react@0.81.4

## 0.81.3

### Patch Changes

- @voyantjs/products@0.81.3
- @voyantjs/react@0.81.3

## 0.81.2

### Patch Changes

- @voyantjs/products@0.81.2
- @voyantjs/react@0.81.2

## 0.81.1

### Patch Changes

- @voyantjs/products@0.81.1
- @voyantjs/react@0.81.1

## 0.81.0

### Patch Changes

- @voyantjs/products@0.81.0
- @voyantjs/react@0.81.0

## 0.80.18

### Patch Changes

- @voyantjs/products@0.80.18
- @voyantjs/react@0.80.18

## 0.80.17

### Patch Changes

- @voyantjs/products@0.80.17
- @voyantjs/react@0.80.17

## 0.80.16

### Patch Changes

- @voyantjs/products@0.80.16
- @voyantjs/react@0.80.16

## 0.80.15

### Patch Changes

- @voyantjs/products@0.80.15
- @voyantjs/react@0.80.15

## 0.80.14

### Patch Changes

- @voyantjs/products@0.80.14
- @voyantjs/react@0.80.14

## 0.80.13

### Patch Changes

- @voyantjs/products@0.80.13
- @voyantjs/react@0.80.13

## 0.80.12

### Patch Changes

- @voyantjs/products@0.80.12
- @voyantjs/react@0.80.12

## 0.80.11

### Patch Changes

- @voyantjs/products@0.80.11
- @voyantjs/react@0.80.11

## 0.80.10

### Patch Changes

- @voyantjs/products@0.80.10
- @voyantjs/react@0.80.10

## 0.80.9

### Patch Changes

- @voyantjs/products@0.80.9
- @voyantjs/react@0.80.9

## 0.80.8

### Patch Changes

- @voyantjs/products@0.80.8
- @voyantjs/react@0.80.8

## 0.80.7

### Patch Changes

- @voyantjs/products@0.80.7
- @voyantjs/react@0.80.7

## 0.80.6

### Patch Changes

- @voyantjs/products@0.80.6
- @voyantjs/react@0.80.6

## 0.80.5

### Patch Changes

- @voyantjs/products@0.80.5
- @voyantjs/react@0.80.5

## 0.80.4

### Patch Changes

- @voyantjs/products@0.80.4
- @voyantjs/react@0.80.4

## 0.80.3

### Patch Changes

- @voyantjs/products@0.80.3
- @voyantjs/react@0.80.3

## 0.80.2

### Patch Changes

- @voyantjs/products@0.80.2
- @voyantjs/react@0.80.2

## 0.80.1

### Patch Changes

- @voyantjs/products@0.80.1
- @voyantjs/react@0.80.1

## 0.80.0

### Patch Changes

- @voyantjs/products@0.80.0
- @voyantjs/react@0.80.0

## 0.79.0

### Patch Changes

- @voyantjs/products@0.79.0
- @voyantjs/react@0.79.0

## 0.78.0

### Patch Changes

- @voyantjs/products@0.78.0
- @voyantjs/react@0.78.0

## 0.77.13

### Patch Changes

- @voyantjs/products@0.77.13
- @voyantjs/react@0.77.13

## 0.77.12

### Patch Changes

- @voyantjs/products@0.77.12
- @voyantjs/react@0.77.12

## 0.77.11

### Patch Changes

- @voyantjs/products@0.77.11
- @voyantjs/react@0.77.11

## 0.77.10

### Patch Changes

- @voyantjs/products@0.77.10
- @voyantjs/react@0.77.10

## 0.77.9

### Patch Changes

- @voyantjs/products@0.77.9
- @voyantjs/react@0.77.9

## 0.77.8

### Patch Changes

- @voyantjs/products@0.77.8
- @voyantjs/react@0.77.8

## 0.77.7

### Patch Changes

- @voyantjs/products@0.77.7
- @voyantjs/react@0.77.7

## 0.77.6

### Patch Changes

- @voyantjs/products@0.77.6
- @voyantjs/react@0.77.6

## 0.77.5

### Patch Changes

- @voyantjs/products@0.77.5
- @voyantjs/react@0.77.5

## 0.77.4

### Patch Changes

- @voyantjs/products@0.77.4
- @voyantjs/react@0.77.4

## 0.77.3

### Patch Changes

- @voyantjs/products@0.77.3
- @voyantjs/react@0.77.3

## 0.77.2

### Patch Changes

- @voyantjs/products@0.77.2
- @voyantjs/react@0.77.2

## 0.77.1

### Patch Changes

- @voyantjs/products@0.77.1
- @voyantjs/react@0.77.1

## 0.77.0

### Patch Changes

- @voyantjs/products@0.77.0
- @voyantjs/react@0.77.0

## 0.76.0

### Patch Changes

- @voyantjs/products@0.76.0
- @voyantjs/react@0.76.0

## 0.75.7

### Patch Changes

- @voyantjs/products@0.75.7
- @voyantjs/react@0.75.7

## 0.75.6

### Patch Changes

- @voyantjs/products@0.75.6
- @voyantjs/react@0.75.6

## 0.75.5

### Patch Changes

- @voyantjs/products@0.75.5
- @voyantjs/react@0.75.5

## 0.75.4

### Patch Changes

- @voyantjs/products@0.75.4
- @voyantjs/react@0.75.4

## 0.75.3

### Patch Changes

- @voyantjs/products@0.75.3
- @voyantjs/react@0.75.3

## 0.75.2

### Patch Changes

- @voyantjs/products@0.75.2
- @voyantjs/react@0.75.2

## 0.75.1

### Patch Changes

- @voyantjs/products@0.75.1
- @voyantjs/react@0.75.1

## 0.75.0

### Patch Changes

- @voyantjs/products@0.75.0
- @voyantjs/react@0.75.0

## 0.74.2

### Patch Changes

- @voyantjs/products@0.74.2
- @voyantjs/react@0.74.2

## 0.74.1

### Patch Changes

- @voyantjs/products@0.74.1
- @voyantjs/react@0.74.1

## 0.74.0

### Patch Changes

- @voyantjs/products@0.74.0
- @voyantjs/react@0.74.0

## 0.73.1

### Patch Changes

- @voyantjs/products@0.73.1
- @voyantjs/react@0.73.1

## 0.73.0

### Patch Changes

- @voyantjs/products@0.73.0
- @voyantjs/react@0.73.0

## 0.72.0

### Patch Changes

- @voyantjs/products@0.72.0
- @voyantjs/react@0.72.0

## 0.71.0

### Patch Changes

- @voyantjs/products@0.71.0
- @voyantjs/react@0.71.0

## 0.70.0

### Patch Changes

- @voyantjs/products@0.70.0
- @voyantjs/react@0.70.0

## 0.69.1

### Patch Changes

- @voyantjs/products@0.69.1
- @voyantjs/react@0.69.1

## 0.69.0

### Patch Changes

- @voyantjs/products@0.69.0
- @voyantjs/react@0.69.0

## 0.68.0

### Patch Changes

- @voyantjs/products@0.68.0
- @voyantjs/react@0.68.0

## 0.67.0

### Patch Changes

- @voyantjs/products@0.67.0
- @voyantjs/react@0.67.0

## 0.66.6

### Patch Changes

- f6634ff: Add per-product customer contract template overrides and surface them through product admin and public catalog payloads.
- Updated dependencies [f6634ff]
  - @voyantjs/products@0.66.6
  - @voyantjs/react@0.66.6

## 0.66.5

### Patch Changes

- @voyantjs/products@0.66.5
- @voyantjs/react@0.66.5

## 0.66.4

### Patch Changes

- @voyantjs/products@0.66.4
- @voyantjs/react@0.66.4

## 0.66.3

### Patch Changes

- @voyantjs/products@0.66.3
- @voyantjs/react@0.66.3

## 0.66.2

### Patch Changes

- @voyantjs/products@0.66.2
- @voyantjs/react@0.66.2

## 0.66.1

### Patch Changes

- @voyantjs/products@0.66.1
- @voyantjs/react@0.66.1

## 0.66.0

### Patch Changes

- @voyantjs/products@0.66.0
- @voyantjs/react@0.66.0

## 0.65.0

### Patch Changes

- @voyantjs/products@0.65.0
- @voyantjs/react@0.65.0

## 0.64.1

### Patch Changes

- @voyantjs/products@0.64.1
- @voyantjs/react@0.64.1

## 0.64.0

### Patch Changes

- @voyantjs/products@0.64.0
- @voyantjs/react@0.64.0

## 0.63.1

### Patch Changes

- @voyantjs/products@0.63.1
- @voyantjs/react@0.63.1

## 0.63.0

### Patch Changes

- @voyantjs/products@0.63.0
- @voyantjs/react@0.63.0

## 0.62.3

### Patch Changes

- @voyantjs/products@0.62.3
- @voyantjs/react@0.62.3

## 0.62.2

### Patch Changes

- 4a87635: Add product translation coverage for localized inclusions/exclusions and expose a product translation authoring card for product title, slug, descriptions, rich text, terms, and SEO copy.
- Updated dependencies [4a87635]
  - @voyantjs/products@0.62.2
  - @voyantjs/react@0.62.2

## 0.62.1

### Patch Changes

- Updated dependencies [ebbeab8]
  - @voyantjs/products@0.62.1
  - @voyantjs/react@0.62.1

## 0.62.0

### Patch Changes

- @voyantjs/products@0.62.0
- @voyantjs/react@0.62.0

## 0.61.0

### Patch Changes

- 89f033e: Add product-level terms and conditions fields to products and product translations. The products API, React runtime schemas, and products UI now expose product terms content, and deployment migrations add `terms_html` plus `terms_show_on_contract`.
- Updated dependencies [89f033e]
  - @voyantjs/products@0.61.0
  - @voyantjs/react@0.61.0

## 0.60.0

### Patch Changes

- @voyantjs/products@0.60.0
- @voyantjs/react@0.60.0

## 0.59.0

### Minor Changes

- 48927be: Release the changes accumulated on main since 0.58.0 that landed without
  their own changesets.

  - **products / products-react / products-ui** — add `inclusionsHtml` and
    `exclusionsHtml` rich-text fields on `ProductRecord` plus the supporting
    product-form + product-detail UI (#994). Consumer test fixtures may need
    `inclusionsHtml: null, exclusionsHtml: null` added.
  - **catalog** — widen `CancelResult.status` to include `"pending"` for
    adapters that submit async cancellations (email / partner portal / batch)
    with a `pending_channel` (#991). Downstream consumers using the narrow
    `"cancelled" | "refused" | "failed"` union need to either widen their
    surface or map `"pending"` at the boundary.
  - **ui** — drop heavy passthrough re-exports from `@voyantjs/ui/components`
    barrel: `RichTextEditor`, `chart`, `dashboard-widgets`, `phone-input`,
    and all `NotificationTemplate*` / `notification-template-dialog` /
    `notification-{deliveries,reminder-rules,reminder-runs}-page` entries.
    Import these via subpath from `@voyantjs/ui/components/<file>` instead
    (e.g. `@voyantjs/ui/components/rich-text-editor`). Was leaking ~600 KB
    of tiptap/prosemirror, ~390 KB of recharts, and ~200 KB of
    libphonenumber-js into every barrel consumer.
  - **admin** — drop `DashboardPage` from the `@voyantjs/admin` barrel for
    the same reason (recharts leakage). Import from
    `@voyantjs/admin/dashboard` instead.

### Patch Changes

- Updated dependencies [48927be]
  - @voyantjs/products@0.59.0
  - @voyantjs/react@0.59.0

## 0.58.0

### Patch Changes

- @voyantjs/products@0.58.0
- @voyantjs/react@0.58.0

## 0.57.0

### Patch Changes

- @voyantjs/products@0.57.0
- @voyantjs/react@0.57.0

## 0.56.0

### Patch Changes

- @voyantjs/products@0.56.0
- @voyantjs/react@0.56.0

## 0.55.1

### Patch Changes

- Updated dependencies [819c847]
  - @voyantjs/products@0.55.1
  - @voyantjs/react@0.55.1

## 0.55.0

### Patch Changes

- @voyantjs/products@0.55.0
- @voyantjs/react@0.55.0

## 0.54.0

### Patch Changes

- @voyantjs/products@0.54.0
- @voyantjs/react@0.54.0

## 0.53.2

### Patch Changes

- Updated dependencies [fc3bc6f]
  - @voyantjs/products@0.53.2
  - @voyantjs/react@0.53.2

## 0.53.1

### Patch Changes

- @voyantjs/products@0.53.1
- @voyantjs/react@0.53.1

## 0.53.0

### Patch Changes

- @voyantjs/products@0.53.0
- @voyantjs/react@0.53.0

## 0.52.4

### Patch Changes

- @voyantjs/products@0.52.4
- @voyantjs/react@0.52.4

## 0.52.3

### Patch Changes

- 9679a57: Add the initial action ledger package with append-only ledger schemas, TypeID prefixes, canonical idempotency fingerprints, capability registry and guard helpers, query helpers, request-context ledger helpers, shared target timeline serialization, payload/relay append support, booking PII sensitive-read ledgering, booking traveler and travel-detail mutation ledgering, booking item/note/payment-policy mutation ledgering, booking action capability declarations and approval decision routing, booking action-ledger drift checks and dry-run remediation planning, finance invoice issuance/update/delete, invoice line-item ledgering, payment-session creation/update/lifecycle completion/failure/cancellation/expiration, payment instrument and authorization/capture ledgering, booking payment schedule and guarantee/default-plan ledgering, manual payment, supplier payment, and credit-note plus credit-note line-item ledgering, product create/update/delete ledgering with changed-field summaries and product timelines, nested product option, option-unit, translation, itinerary, day, day-service, media, brochure, feature, FAQ, location, taxonomy-link, destination-link, activation-setting, ticket-setting, visibility-setting, capability, and delivery-format mutation ledgering, product action-ledger drift checks, product admin route module splitting, admin list/detail routes with expanded filters and time windows plus payload and relay refs, relay outbox health listing with time windows and lifecycle helpers, runtime schema/route mounting, finance React client hooks for invoice and payment-session action ledger timelines, operator invoice/payment-session timeline mounting, product React client hooks and product detail activity UI, drift/canary health helpers and operator health endpoints, reversal recording support, route schema module split, client-safe React validation subpath imports, and reusable finance UI action ledger cards.
- Updated dependencies [9679a57]
  - @voyantjs/products@0.52.3
  - @voyantjs/react@0.52.3

## 0.52.2

### Patch Changes

- Updated dependencies [3e09123]
  - @voyantjs/products@0.52.2
  - @voyantjs/react@0.52.2

## 0.52.1

### Patch Changes

- @voyantjs/products@0.52.1
- @voyantjs/react@0.52.1

## 0.52.0

### Patch Changes

- @voyantjs/products@0.52.0
- @voyantjs/react@0.52.0

## 0.51.1

### Patch Changes

- @voyantjs/products@0.51.1
- @voyantjs/react@0.51.1

## 0.51.0

### Patch Changes

- @voyantjs/products@0.51.0
- @voyantjs/react@0.51.0

## 0.50.8

### Patch Changes

- @voyantjs/products@0.50.8
- @voyantjs/react@0.50.8

## 0.50.7

### Patch Changes

- @voyantjs/products@0.50.7
- @voyantjs/react@0.50.7

## 0.50.6

### Patch Changes

- Updated dependencies [c14f0a8]
  - @voyantjs/products@0.50.6
  - @voyantjs/react@0.50.6

## 0.50.5

### Patch Changes

- @voyantjs/products@0.50.5
- @voyantjs/react@0.50.5

## 0.50.4

### Patch Changes

- @voyantjs/products@0.50.4
- @voyantjs/react@0.50.4

## 0.50.3

### Patch Changes

- @voyantjs/products@0.50.3
- @voyantjs/react@0.50.3

## 0.50.2

### Patch Changes

- @voyantjs/products@0.50.2
- @voyantjs/react@0.50.2

## 0.50.1

### Patch Changes

- @voyantjs/products@0.50.1
- @voyantjs/react@0.50.1

## 0.50.0

### Patch Changes

- @voyantjs/products@0.50.0
- @voyantjs/react@0.50.0

## 0.49.0

### Patch Changes

- @voyantjs/products@0.49.0
- @voyantjs/react@0.49.0

## 0.48.0

### Patch Changes

- @voyantjs/products@0.48.0
- @voyantjs/react@0.48.0

## 0.47.0

### Patch Changes

- @voyantjs/products@0.47.0
- @voyantjs/react@0.47.0

## 0.46.0

### Patch Changes

- @voyantjs/products@0.46.0
- @voyantjs/react@0.46.0

## 0.45.0

### Patch Changes

- @voyantjs/products@0.45.0
- @voyantjs/react@0.45.0

## 0.44.0

### Patch Changes

- @voyantjs/products@0.44.0
- @voyantjs/react@0.44.0

## 0.43.0

### Patch Changes

- @voyantjs/products@0.43.0
- @voyantjs/react@0.43.0

## 0.42.0

### Patch Changes

- @voyantjs/products@0.42.0
- @voyantjs/react@0.42.0

## 0.41.3

### Patch Changes

- @voyantjs/products@0.41.3
- @voyantjs/react@0.41.3

## 0.41.2

### Patch Changes

- @voyantjs/products@0.41.2
- @voyantjs/react@0.41.2

## 0.41.1

### Patch Changes

- @voyantjs/products@0.41.1
- @voyantjs/react@0.41.1

## 0.41.0

### Patch Changes

- @voyantjs/products@0.41.0
- @voyantjs/react@0.41.0

## 0.40.1

### Patch Changes

- @voyantjs/products@0.40.1
- @voyantjs/react@0.40.1

## 0.40.0

### Patch Changes

- @voyantjs/products@0.40.0
- @voyantjs/react@0.40.0

## 0.39.0

### Patch Changes

- @voyantjs/products@0.39.0
- @voyantjs/react@0.39.0

## 0.38.2

### Patch Changes

- @voyantjs/products@0.38.2
- @voyantjs/react@0.38.2

## 0.38.1

### Patch Changes

- @voyantjs/products@0.38.1
- @voyantjs/react@0.38.1

## 0.38.0

### Patch Changes

- @voyantjs/products@0.38.0
- @voyantjs/react@0.38.0

## 0.37.1

### Patch Changes

- @voyantjs/products@0.37.1
- @voyantjs/react@0.37.1

## 0.37.0

### Patch Changes

- @voyantjs/products@0.37.0
- @voyantjs/react@0.37.0

## 0.36.0

### Patch Changes

- @voyantjs/products@0.36.0
- @voyantjs/react@0.36.0

## 0.35.0

### Patch Changes

- @voyantjs/products@0.35.0
- @voyantjs/react@0.35.0

## 0.34.0

### Patch Changes

- Updated dependencies [f8312f5]
  - @voyantjs/products@0.34.0
  - @voyantjs/react@0.34.0

## 0.33.1

### Patch Changes

- @voyantjs/products@0.33.1
- @voyantjs/react@0.33.1

## 0.33.0

### Patch Changes

- @voyantjs/products@0.33.0
- @voyantjs/react@0.33.0

## 0.32.3

### Patch Changes

- @voyantjs/products@0.32.3
- @voyantjs/react@0.32.3

## 0.32.2

### Patch Changes

- @voyantjs/products@0.32.2
- @voyantjs/react@0.32.2

## 0.32.1

### Patch Changes

- @voyantjs/products@0.32.1
- @voyantjs/react@0.32.1

## 0.32.0

### Patch Changes

- @voyantjs/products@0.32.0
- @voyantjs/react@0.32.0

## 0.31.4

### Patch Changes

- @voyantjs/products@0.31.4
- @voyantjs/react@0.31.4

## 0.31.3

### Patch Changes

- @voyantjs/products@0.31.3
- @voyantjs/react@0.31.3

## 0.31.2

### Patch Changes

- @voyantjs/products@0.31.2
- @voyantjs/react@0.31.2

## 0.31.1

### Patch Changes

- Updated dependencies [00f7c4f]
  - @voyantjs/products@0.31.1
  - @voyantjs/react@0.31.1

## 0.31.0

### Patch Changes

- @voyantjs/products@0.31.0
- @voyantjs/react@0.31.0

## 0.30.7

### Patch Changes

- @voyantjs/products@0.30.7
- @voyantjs/react@0.30.7

## 0.30.6

### Patch Changes

- @voyantjs/products@0.30.6
- @voyantjs/react@0.30.6

## 0.30.5

### Patch Changes

- @voyantjs/products@0.30.5
- @voyantjs/react@0.30.5

## 0.30.4

### Patch Changes

- @voyantjs/products@0.30.4
- @voyantjs/react@0.30.4

## 0.30.3

### Patch Changes

- @voyantjs/products@0.30.3
- @voyantjs/react@0.30.3

## 0.30.2

### Patch Changes

- @voyantjs/products@0.30.2
- @voyantjs/react@0.30.2

## 0.30.1

### Patch Changes

- @voyantjs/products@0.30.1
- @voyantjs/react@0.30.1

## 0.30.0

### Patch Changes

- @voyantjs/products@0.30.0
- @voyantjs/react@0.30.0

## 0.29.0

### Patch Changes

- Updated dependencies [11443d3]
- Updated dependencies [828fee4]
- Updated dependencies [06c2cf1]
- Updated dependencies [143f45c]
- Updated dependencies [2baf762]
- Updated dependencies [da3b6fd]
- Updated dependencies [583326e]
  - @voyantjs/products@0.29.0
  - @voyantjs/react@0.29.0

## 0.28.3

### Patch Changes

- @voyantjs/products@0.28.3
- @voyantjs/react@0.28.3

## 0.28.2

### Patch Changes

- Updated dependencies [4549ebc]
  - @voyantjs/products@0.28.2
  - @voyantjs/react@0.28.2

## 0.28.1

### Patch Changes

- @voyantjs/products@0.28.1
- @voyantjs/react@0.28.1

## 0.28.0

### Patch Changes

- Updated dependencies [b72948d]
  - @voyantjs/products@0.28.0
  - @voyantjs/react@0.28.0

## 0.27.0

### Patch Changes

- @voyantjs/products@0.27.0
- @voyantjs/react@0.27.0

## 0.26.9

### Patch Changes

- @voyantjs/products@0.26.9
- @voyantjs/react@0.26.9

## 0.26.8

### Patch Changes

- @voyantjs/products@0.26.8
- @voyantjs/react@0.26.8

## 0.26.7

### Patch Changes

- @voyantjs/products@0.26.7
- @voyantjs/react@0.26.7

## 0.26.6

### Patch Changes

- @voyantjs/products@0.26.6
- @voyantjs/react@0.26.6

## 0.26.5

### Patch Changes

- @voyantjs/products@0.26.5
- @voyantjs/react@0.26.5

## 0.26.4

### Patch Changes

- @voyantjs/products@0.26.4
- @voyantjs/react@0.26.4

## 0.26.3

### Patch Changes

- @voyantjs/products@0.26.3
- @voyantjs/react@0.26.3

## 0.26.2

### Patch Changes

- @voyantjs/products@0.26.2
- @voyantjs/react@0.26.2

## 0.26.1

### Patch Changes

- @voyantjs/products@0.26.1
- @voyantjs/react@0.26.1

## 0.26.0

### Patch Changes

- @voyantjs/products@0.26.0
- @voyantjs/react@0.26.0

## 0.25.0

### Patch Changes

- @voyantjs/products@0.25.0
- @voyantjs/react@0.25.0

## 0.24.3

### Patch Changes

- @voyantjs/products@0.24.3
- @voyantjs/react@0.24.3

## 0.24.2

### Patch Changes

- @voyantjs/products@0.24.2
- @voyantjs/react@0.24.2

## 0.24.1

### Patch Changes

- @voyantjs/products@0.24.1
- @voyantjs/react@0.24.1

## 0.24.0

### Patch Changes

- @voyantjs/products@0.24.0
- @voyantjs/react@0.24.0

## 0.23.0

### Patch Changes

- @voyantjs/products@0.23.0
- @voyantjs/react@0.23.0

## 0.22.0

### Patch Changes

- @voyantjs/products@0.22.0
- @voyantjs/react@0.22.0

## 0.21.1

### Patch Changes

- @voyantjs/products@0.21.1
- @voyantjs/react@0.21.1

## 0.21.0

### Minor Changes

- 6427bad: Release the booking journey architecture train.

  This adds booking hold policy support, richer traveler and booking journey flows, operator tax policy configuration, finance billing and tax policy APIs, notification reminder target and delivery tooling, and the template/runtime wiring needed for the operator storefront checkout flow.

### Patch Changes

- Updated dependencies [6427bad]
  - @voyantjs/products@0.21.0
  - @voyantjs/react@0.21.0

## 0.20.0

### Patch Changes

- @voyantjs/products@0.20.0
- @voyantjs/react@0.20.0

## 0.19.0

### Patch Changes

- @voyantjs/products@0.19.0
- @voyantjs/react@0.19.0

## 0.18.0

### Patch Changes

- Updated dependencies [8932f60]
  - @voyantjs/products@0.18.0
  - @voyantjs/react@0.18.0

## 0.17.0

### Minor Changes

- 66d722d: `GET /v1/products` now accepts three new optional query params: `productTypeId` (direct equality on `products.product_type_id`), `categoryId` (`EXISTS` subquery against `product_category_products`), and `tag` (Postgres jsonb `@>` containment on `products.tags`).

  `ProductsListFilters` in `@voyantjs/products-react/src/query-keys.ts` mirrors the new fields, and `getProductsQueryOptions` forwards them as URL query params. Consumers organising products by type (admin sidebars per travel-type, storefront category pages) can now filter server-side instead of fetching everything and filtering client-side.

### Patch Changes

- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
  - @voyantjs/products@0.17.0
  - @voyantjs/react@0.17.0

## 0.16.0

### Patch Changes

- Updated dependencies [a4bc773]
  - @voyantjs/products@0.16.0
  - @voyantjs/react@0.16.0

## 0.15.0

### Patch Changes

- @voyantjs/products@0.15.0
- @voyantjs/react@0.15.0

## 0.14.0

### Patch Changes

- @voyantjs/products@0.14.0
- @voyantjs/react@0.14.0

## 0.13.0

### Patch Changes

- @voyantjs/products@0.13.0
- @voyantjs/react@0.13.0

## 0.12.0

### Patch Changes

- @voyantjs/products@0.12.0
- @voyantjs/react@0.12.0

## 0.11.0

### Patch Changes

- @voyantjs/products@0.11.0
- @voyantjs/react@0.11.0

## 0.10.0

### Patch Changes

- @voyantjs/products@0.10.0
- @voyantjs/react@0.10.0

## 0.9.0

### Patch Changes

- @voyantjs/products@0.9.0
- @voyantjs/react@0.9.0

## 0.8.0

### Patch Changes

- @voyantjs/products@0.8.0
- @voyantjs/react@0.8.0

## 0.7.0

### Patch Changes

- @voyantjs/products@0.7.0
- @voyantjs/react@0.7.0

## 0.6.9

### Patch Changes

- @voyantjs/products@0.6.9
- @voyantjs/react@0.6.9

## 0.6.8

### Patch Changes

- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
- Updated dependencies [b218885]
  - @voyantjs/products@0.6.8
  - @voyantjs/react@0.6.8

## 0.6.7

### Patch Changes

- @voyantjs/products@0.6.7
- @voyantjs/react@0.6.7

## 0.6.6

### Patch Changes

- @voyantjs/products@0.6.6
- @voyantjs/react@0.6.6

## 0.6.5

### Patch Changes

- @voyantjs/products@0.6.5
- @voyantjs/react@0.6.5

## 0.6.4

### Patch Changes

- @voyantjs/products@0.6.4
- @voyantjs/react@0.6.4

## 0.6.3

### Patch Changes

- @voyantjs/products@0.6.3
- @voyantjs/react@0.6.3

## 0.6.2

### Patch Changes

- @voyantjs/products@0.6.2
- @voyantjs/react@0.6.2

## 0.6.1

### Patch Changes

- @voyantjs/products@0.6.1
- @voyantjs/react@0.6.1

## 0.6.0

### Patch Changes

- @voyantjs/products@0.6.0
- @voyantjs/react@0.6.0

## 0.5.0

### Patch Changes

- @voyantjs/products@0.5.0
- @voyantjs/react@0.5.0

## 0.4.5

### Patch Changes

- @voyantjs/products@0.4.5
- @voyantjs/react@0.4.5

## 0.4.4

### Patch Changes

- @voyantjs/products@0.4.4
- @voyantjs/react@0.4.4

## 0.4.3

### Patch Changes

- @voyantjs/products@0.4.3
- @voyantjs/react@0.4.3

## 0.4.2

### Patch Changes

- @voyantjs/products@0.4.2
- @voyantjs/react@0.4.2

## 0.4.1

### Patch Changes

- @voyantjs/products@0.4.1
- @voyantjs/react@0.4.1

## 0.4.0

### Patch Changes

- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
  - @voyantjs/products@0.4.0
  - @voyantjs/react@0.4.0

## 0.3.1

### Patch Changes

- 8566f2d: Republish the public storefront package surfaces so published tarballs match the
  current source tree. This release restores the public finance schemas needed by
  `@voyantjs/finance-react`, publishes the public booking and product service
  exports already present in source, and ships the day/version/media product React
  exports from the package root.
- Updated dependencies [8566f2d]
- Updated dependencies [8566f2d]
  - @voyantjs/products@0.3.1
  - @voyantjs/react@0.3.1

## 0.3.0

### Patch Changes

- e57725d: Flatten frontend provider wiring around a shared `@voyantjs/react` config provider so module react packages can share one app-level Voyant context.
- Updated dependencies [e57725d]
  - @voyantjs/products@0.3.0
  - @voyantjs/react@0.3.0

## 0.2.0

### Minor Changes

- c20ea90: Introduce `@voyantjs/products-react` as the publishable React runtime package for product list/detail flows and add the first reusable product registry blocks.

### Patch Changes

- @voyantjs/products@0.2.0
