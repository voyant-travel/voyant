---
"@voyant-travel/commerce": patch
---

Add a read-only public market discovery endpoint. `GET /v1/public/markets` is now reachable anonymously (no admin auth) and returns the supported markets, each with its active locales and currencies, using a narrow customer projection — `id`, `code`, `name`, `regionCode`, `countryCode`, `defaultLocale`, `defaultCurrency`, plus `locales` and `currencies`. No admin/tenant-internal fields (`status`, `timezone`, `taxContext`, `metadata`, FX rate sets, exchange rates, price catalogs, product/channel rules, or the per-currency `isSettlement`/`isReporting` flags) are exposed. Only `active` markets are listed. The market `id` is the catalog-search scope key storefronts thread into search as the `market` parameter (the catalog runtime indexes/searches slices keyed by `market.id`); `code`/`name` are for display.
