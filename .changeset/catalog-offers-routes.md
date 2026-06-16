---
"@voyant-travel/catalog": minor
---

The catalog module now owns the offers/search routes: new `@voyant-travel/catalog/offers` export (`createCatalogOffersAdminRoutes(options)`) for package-offers/detail/search/airports/cruise-pricing, with the Connect client, Typesense index lookup, and geo resolver injected as options (catalog keeps no static connect-sdk/typesense import).
