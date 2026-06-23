---
"@voyant-travel/hono": minor
"@voyant-travel/commerce": minor
---

Modules can own their OpenAPI contract (voyant#2114).

The composed app root is now an `OpenAPIHono`, so routes authored with
`@hono/zod-openapi`'s `createRoute(...).openapi(...)` contribute to a generated
OpenAPI document at their real composed path. A new
`@voyant-travel/hono/openapi` entrypoint exposes `generateOpenApiDocument` +
`selectSurface` for build-time generation (kept off the package barrel so the
doc generator stays out of the Worker runtime bundle). Existing plain routes are
unaffected.

The `commerce` markets list route is the first to declare its contract this way,
using `listResponseSchema(...)` from `@voyant-travel/types` for its response
envelope.
