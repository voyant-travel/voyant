---
"@voyant-travel/framework-migrations": minor
---

New package `@voyant-travel/framework-migrations` — the D.1 multi-source migration collector (Workstream D, foundation slice). Productionizes the validated `spikes/d1-migration-collector` approach:

- `planMigrations` / `applyMigrations` — apply migrations across ordered sources (framework bundle first, then the deployment's own) via one **version-independent** ledger keyed by `(source, tag, content_hash)`. Idempotent re-runs, framework-first ordering, per-migration transactions, drizzle `--> statement-breakpoint` splitting, and **content-hash immutability** (`MigrationImmutabilityError` if a shipped migration changed after it was applied).
- `loadMigrationFolder` — read a drizzle `migrations/` folder (`meta/_journal.json` + `*.sql`) into ordered statements.

Transport-agnostic (takes an injected pg-compatible client; no `pg` dependency in the library). Integration tests reproduce the spike's 5 scenarios against Postgres (skipped when `TEST_DATABASE_URL` is unset). This slice does **not** change any live migration runner — see `docs/architecture/migration-collector-d1.md` for the ADR and the remaining slices (bundle generation, replay oracle, runner cutover).
