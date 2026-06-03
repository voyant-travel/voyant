# @voyantjs/schema-kit

## 0.101.2

### Patch Changes

- 577eaf5: Add in-context translations for products and itinerary days.

  - `@voyantjs/products`: add a `products.default_language_tag` column (the language the base name/description columns are written in) and a new `product_day_translations` table (per-language title/description/location) with CRUD service methods and routes under `/v1/products/:id/days/:dayId/translations`.
  - `@voyantjs/products-contracts`: validation schemas for the product default language and itinerary-day translations.
  - `@voyantjs/products-react`: `useProductDayTranslations` / `useProductDayTranslationMutation` hooks, record/response schemas, and query keys; the product record now exposes `defaultLanguageTag`.
  - `@voyantjs/schema-kit`: `product_day_translations` TypeID prefix (`pdtr`).
  - `@voyantjs/i18n`: operator labels for the content-language switcher, default language, itinerary-day sheet, and market-rule columns.

## 0.101.1

## 0.101.0

## 0.100.0

## 0.99.0

## 0.98.0

## 0.97.0

### Minor Changes

- 7094c8e: Add `@voyantjs/schema-kit` and extend the `*-contracts` pattern to the
  operational modules.

  `@voyantjs/schema-kit` (pure: zod + typeid-js) is the new foundational home for
  schema primitives shared by the runtime and the contract packages — the TypeID
  system (prefix registry, id generation, zod validators), `booleanQueryParam`,
  and `kmsEnvelopeSchema`. These moved out of `@voyantjs/db` (which now re-exports
  them from their original paths, so every call-site is unchanged) so they sit
  below the data layer and the contract packages can depend on them without
  pulling Drizzle.

  New zod-only contract packages own each module's validation surface (schemas +
  enums): `@voyantjs/bookings-contracts`, `@voyantjs/finance-contracts`,
  `@voyantjs/crm-contracts`, `@voyantjs/transactions-contracts`,
  `@voyantjs/suppliers-contracts`, `@voyantjs/identity-contracts`, and
  `@voyantjs/legal-contracts`. Each runtime module re-exports from its contracts
  package, so existing `@voyantjs/<module>/validation` import paths are unchanged.
  Shared primitives come from `@voyantjs/schema-kit`, keeping the contract
  packages free of the data layer.

  (`legal-contracts` still transitively depends on `@voyantjs/utils` for the
  template-syntax validator used by contract validation — a tracked follow-up
  would purify it.)
