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
"@voyant-travel/operator-settings": patch
"@voyant-travel/action-ledger": patch
"@voyant-travel/workflow-runs": patch
"@voyant-travel/trips": patch
---

D.2 slice 1 (batch 2) — 14 more packages own + ship their migration history (db, relationships, quotes, identity, distribution, inventory, commerce, catalog, finance, notifications, legal, storefront, charters, cruises). Each baseline reproduces the framework bundle's tables column-for-column, and all package sources now apply together (fresh-D.2 union) without collision.

Shared enums: the codebase inlines copies of some enums to avoid cross-package schema imports (e.g. `service_type` in distribution + inventory, `entity_type` in relationships + quotes). Per-package generation would emit duplicate `CREATE TYPE`, colliding on a fresh D.2 database. All package migrations now wrap `CREATE TYPE … AS ENUM(…)` in an idempotent `DO`-block guard (subset-safe; whichever source applies first creates the type, the rest no-op). The db package additionally owns the shared Postgres extensions (pg_trgm / unaccent) that downstream trigram indexes need on a fresh D.2 database (the retired bundle injected them; per-package sources did not). The batch-1 packages (operator-settings, action-ledger, workflow-runs, trips) get the same guard for uniformity. No runtime change. See `docs/architecture/migration-collector-d2.md`.
