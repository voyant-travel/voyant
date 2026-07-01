---
"@voyant-travel/hono": minor
"@voyant-travel/openapi": minor
---

Stamp `x-voyant-module` and `x-voyant-surface` on every OpenAPI operation.

Follow-up to the per-module spec split (voyant#2733) and a step toward
voyant#2729. Each operation in the generated specs (aggregate + per-module) now
carries `x-voyant-module` and `x-voyant-surface` extensions, so the specs are
self-describing — a module-grouped docs UI or a client generator can read the
owning module and surface off each operation instead of re-deriving them from
path prefixes. The module is the authoritative owner from the mount manifest, so
`publicPath` routes are labelled with their real owning module (e.g.
`/v1/public/payment-policy/resolve` → `x-voyant-module: bookings`) rather than
their mount prefix.

`@voyant-travel/hono/openapi` exposes the underlying pieces:
`buildModulePathOwnership` (path → module map), `partitionByModule`
(synchronous split from a precomputed map), and `stampModuleMetadata`.
`splitDocumentByModule` is retained as a convenience wrapper.
