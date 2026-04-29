---
"@voyantjs/products": patch
---

Export `destinations`, `destinationTranslations`, and `productDestinations` from the `@voyantjs/products` barrel. They were defined in `schema-taxonomy.ts` and re-exported from `schema.ts` but missing from the public `index.ts`. Consumers walking the destination tree (CRM analytics, search indexers, country-tag derivation) can now import from the package root instead of using deep paths or raw SQL.
