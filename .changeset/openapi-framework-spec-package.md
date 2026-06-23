---
"@voyant-travel/openapi": minor
---

New package: the generated OpenAPI 3.1 spec for the Voyant framework's standard
API surface (voyant#2114).

Ships JSON only (no runtime deps): `@voyant-travel/openapi` (full),
`@voyant-travel/openapi/admin` (`/v1/admin/*`), `@voyant-travel/openapi/storefront`
(`/v1/public/*`). The spec is generated from the framework's standard module
composition — the union of each module's `.openapi()` contracts — so it's the
portable framework contract, not any single deployment's surface. A drift gate
keeps the committed artifacts in sync with the handlers; refresh with
`pnpm --filter @voyant-travel/openapi generate`.
