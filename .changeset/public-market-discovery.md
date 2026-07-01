---
"@voyant-travel/commerce": patch
---

Add a read-only public market discovery endpoint. `GET /v1/public/markets` is now reachable anonymously (no admin auth) and returns the supported markets, each with its active locales and currencies, using a narrow customer projection — only `code`, `name`, `regionCode`, `countryCode`, `defaultLocale`, `defaultCurrency`, plus `locales` and `currencies`. No admin/tenant-internal fields (market `id`, `status`, `timezone`, `taxContext`, `metadata`, FX rate sets, exchange rates, price catalogs, product/channel rules, or the per-currency `isSettlement`/`isReporting` flags) are exposed. Only `active` markets are listed. The market `code` is the scope key storefronts already thread into catalog search as `market`.
