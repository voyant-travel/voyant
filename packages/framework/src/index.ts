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
export { type CreateVoyantAppConfig, createVoyantApp } from "./create-app.js"
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
  type LowerVoyantGraphActionsOptions,
  lowerVoyantGraphActionsToActionLedgerRegistry,
  type VoyantGraphActionRiskEvaluator,
} from "./graph-action-ledger.js"
export {
  FRAMEWORK_CAPABILITY_GRAPH,
  FRAMEWORK_EXTENSION_OWNERSHIP,
  FRAMEWORK_RUNTIME_MANIFEST,
  type FrameworkManifest,
  ownedExtensionsForExcludedModules,
  subsetStandardManifest,
} from "./manifest.js"
export {
  type SelectStandardOperatorDistributionOptions,
  STANDARD_OPERATOR_DISTRIBUTION,
  STANDARD_OPERATOR_DISTRIBUTION_POLICY,
  selectStandardOperatorDistribution,
} from "./operator-distribution.js"
export {
  assertPortConforms,
  type DefineVoyantPortInput,
  definePort,
  providePort,
  type RequireVoyantPortOptions,
  requirePort,
  type VoyantPort,
  type VoyantPortConformanceTest,
} from "./ports.js"
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
  type VoyantProfileModuleMigrationSource,
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
  type DefineVoyantConfigInput,
  defineConfig,
  VOYANT_PROJECT_WORKFLOW_RUNTIME_ENTRY,
} from "./project.js"
export {
  type ProjectArtifactWriteEntry,
  type ProjectArtifactWriteMode,
  type ProjectArtifactWriteResult,
  type ProjectArtifactWriteStatus,
  type WriteProjectArtifactsInput,
  writeProjectArtifacts,
} from "./project-artifacts.js"
export {
  type ComposeVoyantGraphRuntimeInput,
  composeVoyantGraphRuntime,
  composeVoyantGraphRuntimeFacetModules,
  type VoyantGraphRuntimeBinding,
  type VoyantGraphRuntimeBindingContext,
  type VoyantGraphRuntimeBindings,
  type VoyantGraphRuntimeComposition,
} from "./runtime-composition.js"
export {
  type CreateVoyantGraphRuntimeInput,
  createVoyantGraphRuntime,
  registerVoyantGraphTools,
  VOYANT_GRAPH_RUNTIME_LOAD_ERROR_CODES,
  type VoyantGraphRuntime,
  type VoyantGraphRuntimeActionDefinition,
  type VoyantGraphRuntimeConfigDefinition,
  type VoyantGraphRuntimeConfigLoader,
  VoyantGraphRuntimeLoadError,
  type VoyantGraphRuntimeLoadErrorCode,
  type VoyantGraphRuntimeProviderDefinition,
  type VoyantGraphRuntimeProviderLoader,
  type VoyantGraphRuntimeResourceDefinition,
  type VoyantGraphRuntimeRouteDefinition,
  type VoyantGraphRuntimeRouteLoader,
  type VoyantGraphRuntimeSecretDefinition,
  type VoyantGraphRuntimeSecretLoader,
  type VoyantGraphRuntimeSelectedIds,
  type VoyantGraphRuntimeToolDefinition,
  type VoyantGraphRuntimeToolLoader,
  type VoyantGraphRuntimeUnitDefinition,
  type VoyantGraphRuntimeUnitLoader,
  type VoyantGraphRuntimeWebhookPlan,
  type VoyantGraphRuntimeWorkflowDefinition,
  type VoyantGraphRuntimeWorkflowLoader,
} from "./runtime-lowering.js"
export {
  FRAMEWORK_RUNTIME_PACKAGES,
  type FrameworkRuntimePackage,
} from "./runtime-packages.generated.js"
export {
  type ResolvedVoyantGraphRuntimeProviders,
  type ResolveVoyantGraphRuntimeProvidersInput,
  resolveVoyantGraphRuntimeProviders,
  type SelectedVoyantGraphRuntimeProvider,
  VOYANT_GRAPH_RUNTIME_PROVIDER_ERROR_CODES,
  type VoyantGraphProviderFactory,
  type VoyantGraphProviderFactoryContext,
  VoyantGraphRuntimeProviderError,
  type VoyantGraphRuntimeProviderErrorCode,
  type VoyantGraphRuntimeProviderIssue,
} from "./runtime-providers.js"
export {
  type ResolvedVoyantGraphRuntimeConfig,
  type ResolvedVoyantGraphRuntimeSecret,
  type ResolvedVoyantGraphRuntimeValues,
  type ResolveVoyantGraphRuntimeValuesInput,
  resolveVoyantGraphRuntimeValues,
  VOYANT_GRAPH_RUNTIME_VALUE_ERROR_CODES,
  VoyantGraphRuntimeValueError,
  type VoyantGraphRuntimeValueErrorCode,
  type VoyantGraphRuntimeValueIssue,
} from "./runtime-values.js"
