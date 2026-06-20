---
"@voyant-travel/framework-migrations": minor
---

Export a portable D.2 deployment runner so any deployment (not just the monorepo operator) can adopt package-owned migrations.

- `discoverMigrationSources(schemaPaths, { baseDir, deploymentMigrationsDir })` — resolves each package's shipped `migrations/` folder from the generated schema list, topologically ordered by `voyant.requiresSchemas`. Layout-agnostic: handles both the monorepo `…/packages/<dir>/…` paths and installed `…/node_modules/@voyant-travel/<name>/…` (incl. pnpm `.pnpm/…`) paths, so npm-consuming deployments resolve the same sources the operator does.
- `runDeploymentMigrations(client, sources, cutline)` + `detectExisting` / `assertSchemaAtBaseline` / `expectedSchema` — the FRESH-vs-EXISTING dual-path engine (import-baseline the cutline on a pre-D.2 DB, gated by a schema-parity check), extracted from the operator so deployments share one tested implementation instead of copying it.

The operator's `scripts/migrate.ts` now imports these from the package; its local copies were removed.
