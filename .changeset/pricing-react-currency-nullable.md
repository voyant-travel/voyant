---
"@voyantjs/pricing-react": patch
"@voyantjs/ui": patch
---

Fix #479: `priceCatalogRecordSchema.currencyCode` is now `z.string().nullable()`, matching the DB column, the server-side core schema, and the `#462` "NULL means follow `product.sellCurrency`" semantics. Operators using a single default public catalog with `currency_code = NULL` no longer hit `Voyant API response failed validation` on the catalog-settings page or the departure-pricing-override dialog.

`PriceCatalogRecord["currencyCode"]` is now `string | null`. Registry components in `@voyantjs/ui` (`price-catalogs-page`, `price-catalog-dialog`) render the NULL case as `—` and load it as `""` into the form. Direct consumers of `record.currencyCode` should add a similar fallback.
