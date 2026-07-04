---
"@voyant-travel/openapi": patch
"@voyant-travel/storefront": patch
"@voyant-travel/storefront-react": patch
"@voyant-travel/storefront-sdk": patch
---

Resolve localized public departure itinerary reads by accepting `languageTag`/`lang`
query parameters, applying day and segment translations with base-content fallback,
and exposing the query through first-party storefront clients.
