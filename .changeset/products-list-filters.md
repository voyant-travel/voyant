---
"@voyantjs/products": minor
"@voyantjs/products-react": minor
---

`GET /v1/products` now accepts three new optional query params: `productTypeId` (direct equality on `products.product_type_id`), `categoryId` (`EXISTS` subquery against `product_category_products`), and `tag` (Postgres jsonb `@>` containment on `products.tags`).

`ProductsListFilters` in `@voyantjs/products-react/src/query-keys.ts` mirrors the new fields, and `getProductsQueryOptions` forwards them as URL query params. Consumers organising products by type (admin sidebars per travel-type, storefront category pages) can now filter server-side instead of fetching everything and filtering client-side.
