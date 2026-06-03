---
"@voyantjs/schema-kit": patch
"@voyantjs/products-contracts": patch
"@voyantjs/products": patch
"@voyantjs/products-react": patch
"@voyantjs/i18n": patch
---

Add in-context translations for products and itinerary days.

- `@voyantjs/products`: add a `products.default_language_tag` column (the language the base name/description columns are written in) and a new `product_day_translations` table (per-language title/description/location) with CRUD service methods and routes under `/v1/products/:id/days/:dayId/translations`.
- `@voyantjs/products-contracts`: validation schemas for the product default language and itinerary-day translations.
- `@voyantjs/products-react`: `useProductDayTranslations` / `useProductDayTranslationMutation` hooks, record/response schemas, and query keys; the product record now exposes `defaultLanguageTag`.
- `@voyantjs/schema-kit`: `product_day_translations` TypeID prefix (`pdtr`).
- `@voyantjs/i18n`: operator labels for the content-language switcher, default language, itinerary-day sheet, and market-rule columns.
