---
"@voyant-travel/framework-migrations": minor
"@voyant-travel/framework": minor
---

Give source-free managed images a migration path for custom schema-owning
modules (voyant#3069, Option 1 — modules ship pre-built migrations).

A managed image runs migrations with no drizzle-kit generation, so a custom
"bring-your-own" module that owns schema previously had no way to create its
tables. It now does, following the same per-package `migrations/` convention
standard packages already use.

`@voyant-travel/framework-migrations`:

- `loadModuleBundleSource(packageName, { priority, resolveFrom })` — resolve a
  module package's committed `migrations/` folder by name into a
  `MigrationSource`, or `null` when it ships none (schema-less modules/plugins
  are skipped). Ledger source name is the unscoped package name, stable across
  source and managed modes.
- `collectManagedMigrationSources({ modulePackages, resolveFrom })` — the
  managed migration path: `[framework, ...customModules]` deps-first, ready for
  `runDeploymentMigrations`.

`@voyant-travel/framework`:

- `getVoyantProjectMigrationMetadata(project)` now returns
  `moduleSources: { packageName, priority }[]` derived from the snapshot's
  `customSource.modules`, so the platform migrate booter enumerates the custom
  schema-owning packages to apply after the framework bundle. Adds the
  `VoyantProfileModuleMigrationSource` type.
