---
"@voyant-travel/hono": minor
"@voyant-travel/openapi": minor
---

Generate OpenAPI specs per module instead of committing one giant aggregate.

`@voyant-travel/hono/openapi` gains `generateModuleOpenApiDocuments`, which
builds one self-contained OpenAPI document per module directly from the routes
that module registered — the authoritative boundary — rather than splitting a
composed document by path prefix. The composed app now records an
`app.moduleMounts` manifest (mirroring `app.lazyMounts`) so the generator knows
each module's real mount prefix, including `publicPath` overrides whose prefix
isn't the module name (e.g. `/v1/public/booking-engine`).

`@voyant-travel/openapi` now ships compact, browsable per-module specs under
`spec/{admin,storefront}/<module>.json`, exposed via new `./admin/*` and
`./storefront/*` subpath exports (e.g.
`import bookings from "@voyant-travel/openapi/admin/bookings"`). The
multi-megabyte aggregate specs (`framework-openapi.json` / `-admin` /
`-storefront`) are no longer committed to git — GitHub can't render a 7 MB file
and any route change rewrote the whole thing — but they're still published in
the npm tarball, generated at `prepack`. The `.` / `./admin` / `./storefront`
exports are unchanged.
