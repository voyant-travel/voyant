/**
 * `@voyant-travel/framework-migrations` — the multi-source migration collector:
 * topologically-ordered package + deployment migration sources, applied against
 * a single version-independent ledger, with an import-baseline path for adopting
 * an already-materialised database.
 *
 * See `docs/architecture/migration-collector-d2.md`.
 */

export { frameworkBundleDir, loadFrameworkBundleSource } from "./bundle.js"
export {
  type ApplyMigrationsOptions,
  applyMigrations,
  type MigrationClient,
  MigrationImmutabilityError,
  type MigrationSource,
  type MigrationStatement,
  type PlannedMigration,
  planMigrations,
  VOYANT_MIGRATION_JOURNAL_LINEAGE,
} from "./collector.js"
export { type Cutline, loadCutline } from "./cutline.js"
export {
  assertSchemaAtBaseline,
  detectExisting,
  expectedSchema,
  type RunResult,
  runDeploymentMigrations,
} from "./deployment-runner.js"
export {
  DEPLOYMENT_SOURCE,
  type DiscoveredSource,
  type DiscoverOptions,
  discoverMigrationSources,
  type Fs,
  packageRootOfSchemaPath,
} from "./discover.js"
export { loadMigrationFolder } from "./load-folder.js"
export {
  type CollectDeploymentMigrationSourcesOptions,
  collectDeploymentMigrationSources,
  type LoadModuleBundleSourceOptions,
  loadModuleBundleSource,
  moduleSourceName,
} from "./module-source.js"
