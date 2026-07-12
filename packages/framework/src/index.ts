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
 * Runtime product selection and factories are owned by package manifests and
 * the generated deployment graph. This package retains generic Hono composition
 * helpers for deployment-local units.
 */

export {
  type CreateVoyantAppConfig,
  createVoyantApp,
  type FrameworkProviders,
} from "./create-app.js"
export {
  DEFAULT_MANAGED_CLOUD_PROVIDERS,
  DEPLOYMENT_PROVIDER_CONTRACTS,
  DEPLOYMENT_PROVIDER_ROLES,
  type VoyantDeploymentEnvRequirement,
  type VoyantDeploymentEnvValueFormat,
  type VoyantDeploymentMode,
  type VoyantDeploymentProviderRole,
  type VoyantDeploymentProviders,
  type VoyantDeploymentResourceRequirement,
} from "./deployment-types.js"
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
  type CreateVoyantGraphLifecyclePlanInput,
  createVoyantGraphLifecyclePlan,
  executeVoyantGraphLifecyclePlan,
  type VoyantGraphLifecycleExecutionState,
  type VoyantGraphLifecycleExecutor,
  type VoyantGraphLifecycleOperation,
  type VoyantGraphLifecyclePlan,
  VoyantGraphLifecyclePlanError,
  type VoyantGraphLifecycleStateStore,
  type VoyantGraphLifecycleStep,
  type VoyantGraphLifecycleStepState,
  validateVoyantGraphEventCompatibility,
} from "./graph-lifecycle.js"
export {
  type SelectStandardOperatorDistributionOptions,
  STANDARD_OPERATOR_ACCESS,
  STANDARD_OPERATOR_DEPLOYMENT,
  STANDARD_OPERATOR_DISTRIBUTION,
  STANDARD_OPERATOR_DISTRIBUTION_POLICY,
  STANDARD_OPERATOR_PRODUCT_BOM,
  STANDARD_OPERATOR_PRODUCT_BOM_REFERENCE,
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
  type DefineVoyantConfigInput,
  defineConfig,
  resolveStandardNodeGraphRuntime,
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
  createVoyantGraphRuntimePortStubs,
  resolveVoyantGraphRouteMountPath,
  type VoyantGraphRuntimeBinding,
  type VoyantGraphRuntimeBindingContext,
  type VoyantGraphRuntimeBindings,
  type VoyantGraphRuntimeComposition,
  type VoyantGraphRuntimeContributor,
  type VoyantGraphRuntimeContributorHost,
  type VoyantGraphRuntimePorts,
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
export {
  SCHEDULED_JOB_ROUTE,
  STANDARD_OPERATOR_SCHEDULED_JOBS,
  type VoyantScheduledJob,
} from "./scheduled-jobs.js"
export {
  buildStandardNodeStarterSnapshot,
  STANDARD_NODE_STARTER,
  VOYANT_STANDARD_NODE_STARTER_SCHEMA_VERSION,
} from "./standard-node-starter.js"
