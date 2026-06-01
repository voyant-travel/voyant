---
"@voyantjs/products-contracts": minor
"@voyantjs/products": patch
"@voyantjs/admin-contracts": minor
"@voyantjs/admin-client": minor
---

Extract products validation into the pure `@voyantjs/products-contracts` package
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
