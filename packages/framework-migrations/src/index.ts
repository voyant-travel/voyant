/**
 * `@voyant-travel/framework-migrations` — the D.1 multi-source migration
 * collector + (in a later slice) the framework-shipped standard-profile bundle.
 *
 * See `docs/architecture/migration-collector-d1.md`.
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
} from "./collector.js"
export { loadMigrationFolder } from "./load-folder.js"
