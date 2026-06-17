---
"@voyant-travel/framework-migrations": minor
---

Add `importBaseline(client, sources, options?)` — records a planned set of migrations in the `_voyant_migrations` ledger **without executing their SQL**, for cutting an existing deployment (whose schema is already materialised) onto the collector. Idempotent (`ON CONFLICT DO NOTHING`); the caller must verify schema parity first. The shared ledger DDL is factored into one `ensureLedger` helper used by both `applyMigrations` and `importBaseline`.

This is the collector primitive behind the D.1 runner cutover (slice 4): `migrate.ts` now auto-detects FRESH (execute) / BASELINE (import) / INCREMENTAL (apply-new), with baseline gated by a parity guard. See `docs/architecture/migration-collector-d1.md`.
