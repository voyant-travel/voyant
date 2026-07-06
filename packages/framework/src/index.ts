/**
 * `@voyant-travel/framework` — the Voyant framework BOM (bill of materials).
 *
 * This package's `dependencies` pin the exact tested runtime-module set. A
 * deployment depends on **one** framework version instead of a matrix of
 * per-package versions; `voyant upgrade` bumps it, and pnpm/npm resolve the
 * pinned set transitively. The compatibility matrix is resolved *inside* the
 * BOM — the deployment never sees it.
 *
 * This is deliberately NOT global lockstep: the runtime packages keep
 * independent versions (only changed packages republish — no per-package npm
 * email spam), and the BOM is the single thing that always tracks "the
 * framework version".
 *
 * Beyond the BOM, the package also owns the standard runtime composition: the
 * ordered manifest (`FRAMEWORK_RUNTIME_MANIFEST`) and the standard registry
 * factories (`frameworkComposition`) a deployment spreads — Workstream B of the
 * consolidated-deployments RFC.
 */

export { type FrameworkProviders, frameworkComposition } from "./composition-lazy.js"
export {
  type CreateVoyantAppConfig,
  createVoyantApp,
  subsetStandardManifest,
} from "./create-app.js"
export {
  type DeploymentExtensionDeclaration,
  type DeploymentModuleDeclaration,
  defineDeploymentExtension,
  defineDeploymentModule,
  type EagerModuleGlob,
  extensionsFromGlob,
  modulesFromGlob,
} from "./discover-modules.js"
export {
  FRAMEWORK_CAPABILITY_GRAPH,
  FRAMEWORK_RUNTIME_MANIFEST,
  type FrameworkManifest,
} from "./manifest.js"
export {
  type DefineVoyantProjectInput,
  defineVoyantProject,
  getVoyantProjectMigrationMetadata,
  getVoyantProjectRequirements,
  MANAGED_OPERATOR_DEFAULT_PROVIDERS,
  PROVIDER_CONTRACTS,
  PROVIDER_ROLES,
  toCreateVoyantAppProfileConfig,
  VOYANT_PROFILE_MODULES,
  VOYANT_PROJECT_SCHEMA_VERSION,
  type VoyantProfileAppBridge,
  type VoyantProfileEnvRequirement,
  type VoyantProfileMigrationMetadata,
  type VoyantProfileModuleDefinition,
  type VoyantProfileRequirements,
  type VoyantProfileResourceRequirement,
  type VoyantProfileValidationIssue,
  type VoyantProfileValidationResult,
  type VoyantProjectAdminManifest,
  type VoyantProjectCustomSourceManifest,
  type VoyantProjectDeploymentMode,
  type VoyantProjectJsonValue,
  type VoyantProjectManifest,
  type VoyantProjectModuleReference,
  type VoyantProjectPluginReference,
  type VoyantProjectProfileId,
  type VoyantProjectProviderRole,
  type VoyantProjectProviders,
  type VoyantProjectSchemaVersion,
  type VoyantProjectSettings,
  validateVoyantProject,
} from "./profile.js"
export {
  FRAMEWORK_RUNTIME_PACKAGES,
  type FrameworkRuntimePackage,
} from "./runtime-packages.generated.js"
