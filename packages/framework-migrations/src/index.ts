/**
 * `@voyant-travel/framework-migrations` — the D.1 multi-source migration
 * collector + (in a later slice) the framework-shipped standard-profile bundle.
 *
 * See `docs/architecture/migration-collector-d1.md`.
 */

export { frameworkBundleDir, loadFrameworkBundleSource } from "./bundle.js"
export {
  type ApplyD2MigrationsOptions,
  type ApplyMigrationsOptions,
  applyD2Migrations,
  applyMigrations,
  importBaseline,
  type MigrationClient,
  MigrationImmutabilityError,
  type MigrationSource,
  type MigrationStatement,
  type PlannedMigration,
  planMigrations,
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
