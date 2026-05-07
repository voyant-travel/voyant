---
"@voyantjs/pricing": patch
"@voyantjs/catalog-ui": patch
"@voyantjs/bookings-ui": patch
---

Fall back to `product.sellCurrency` when `price_catalogs.currencyCode` is null in the public pricing snapshot, and stop silently labelling currency-less amounts as EUR.

- `@voyantjs/pricing`: `getProductPricingSnapshot` now resolves the snapshot's `catalog.currencyCode` from the catalog when set, otherwise from the product's `sellCurrency`. Catalogs with a non-null `currencyCode` behave exactly as before; catalogs with `currency_code = NULL` follow each product's native currency, so multi-currency operators can use a single retail catalog instead of one catalog per currency.
- `@voyantjs/catalog-ui`: `formatPriceCents` in the catalog detail sheet now renders plain digits (no currency symbol) when no currency is supplied, instead of mis-labelling amounts as EUR.
- `@voyantjs/bookings-ui`: `formatMoney` in the booking payments summary handles a missing currency the same way.
