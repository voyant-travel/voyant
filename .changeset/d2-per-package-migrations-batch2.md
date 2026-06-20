---
"@voyant-travel/db": patch
"@voyant-travel/relationships": patch
"@voyant-travel/quotes": patch
"@voyant-travel/identity": patch
"@voyant-travel/distribution": patch
"@voyant-travel/inventory": patch
"@voyant-travel/commerce": patch
"@voyant-travel/catalog": patch
"@voyant-travel/finance": patch
"@voyant-travel/notifications": patch
"@voyant-travel/legal": patch
"@voyant-travel/storefront": patch
"@voyant-travel/charters": patch
"@voyant-travel/cruises": patch
---

D.2 slice 1 (batch 2) — these packages now own and ship their migration history. Each gains a `drizzle.migrations.config.ts`, a `db:generate` script, and a generated `migrations/` baseline included in the published tarball (`files`). A D.2 deployment collects each package's folder as its migration source (deps-first, by `voyant.requiresSchemas`); existing D.1 databases import-baseline the bundle-covered baseline. No runtime behavior change. Each baseline was verified to reproduce the framework bundle's tables column-for-column. See `docs/architecture/migration-collector-d2.md`.
