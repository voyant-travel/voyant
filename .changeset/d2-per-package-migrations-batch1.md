---
"@voyant-travel/operator-settings": patch
"@voyant-travel/action-ledger": patch
"@voyant-travel/workflow-runs": patch
"@voyant-travel/trips": patch
---

D.2 slice 1 — these packages now own and ship their migration history. Each gains a `drizzle.migrations.config.ts`, a `db:generate` script, and a generated `migrations/` folder (baseline) included in the published tarball (`files`). A D.2 deployment collects each package's folder as its migration source; existing D.1 databases import-baseline the bundle-covered baseline. No runtime behavior change. See `docs/architecture/migration-collector-d2.md`.
