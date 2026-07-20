---
"@voyant-travel/hono": minor
---

Release the request-time dynamic CORS support in the shared `cors()` middleware
(`resolveDynamicOrigin` + `isDynamicPath`, consumed via
`VoyantAuthIntegration.resolveCorsOrigin`). This code merged with the storefront
direct-client work but was omitted from that release's changeset, so the hono
consumer never published — leaving the per-storefront dynamic CORS chain inert
even though `@voyant-travel/auth` and `@voyant-travel/runtime` shipped their
halves. Publishing hono completes the browser/mobile direct-client storefront
API path.
