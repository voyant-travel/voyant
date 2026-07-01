---
"@voyant-travel/storefront-react": patch
---

Add anonymous market discovery to the storefront client. `useStorefrontMarkets` (plus the `listStorefrontMarkets` operation and `getStorefrontMarketsQueryOptions`) fetches `GET /v1/public/markets` and validates the response against a local `storefrontMarketSchema` mirroring the public projection (`id`, `code`, `name`, `regionCode`, `countryCode`, `defaultLocale`, `defaultCurrency`, `locales`, `currencies`). Storefronts use this to present a market/currency/locale scope selector; the market `id` is the catalog-search scope key threaded into search as the `market` parameter.
