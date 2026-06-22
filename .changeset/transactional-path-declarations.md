---
"@voyant-travel/hono": minor
"@voyant-travel/framework": minor
---

Transactional-path declarations (ADR-0008 Phase 2). `HonoModule`/`HonoExtension` gain `transactionalPaths?: string[]` — absolute API path prefixes that must be served by the transaction-capable db client, for routes mounted outside the name-based surface where only a *subset* transacts (e.g. a lazy family at `/v1/admin/catalog/quote`). `mountApp` folds these into the transactional-prefix map alongside the existing name-based `requiresTransactionalDb`, so a deployment no longer hand-maintains `dbTransactionalPaths`.

The standard families now declare their own transactional surface: `@voyant-travel/trips` is name-based `requiresTransactionalDb` (every trips route reserves), and the catalog booking engine (`operator/catalog-booking`) declares its `quote`/`book`/`holds`/`orders` prefixes via `transactionalPaths` (search/draft/snapshot reads stay on the cheap default client). The operator starter's `dbTransactionalPaths` list is removed entirely.

Additive and non-breaking: `dbTransactionalPaths` is still honored as an escape hatch; a module that declares neither flag is unaffected.
