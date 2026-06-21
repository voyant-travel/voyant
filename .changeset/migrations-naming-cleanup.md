---
"@voyant-travel/framework-migrations": minor
---

Clean up D.1/D.2 transition scaffolding from the migration collector's public API now that there's a single model.

- **`applyD2Migrations` → `applyMigrations`** (the one collector apply path). `cutline`/`existing` are now optional fields on `ApplyMigrationsOptions` — with neither, it simply executes every pending migration; with both, it import-baselines the cutline on an existing DB. Returns `{ executed, baselined }`.
- **Removed** the now-redundant legacy `applyMigrations` (simple) + `importBaseline` + `ApplyD2MigrationsOptions` — the unified `applyMigrations` subsumes them.
- Internal: `scripts/d2/` → `scripts/migrations/`; `verify:d2-*` → `verify:migration-*`; comments/test identifiers dropped the `D.1`/`D.2` labels.

BREAKING: consumers of `applyD2Migrations`/`importBaseline` should call `applyMigrations`. The deployment-facing API (`runDeploymentMigrations`, `discoverMigrationSources`, `loadCutline`, `loadMigrationFolder`) is unchanged.
