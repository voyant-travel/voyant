import {
  type DefineVoyantGraphProjectInput,
  defineProject,
  type VoyantGraphProject,
} from "@voyant-travel/core/project"
import {
  mergeOperatorDistributionDefaults,
  type OperatorDistributionDifferences,
} from "./operator-distribution.js"

export * from "@voyant-travel/core/project"
export type {
  NodeMigrationExecutionReport,
  NodeMigrationRunnerOptions,
  SetupMigrationHandler,
} from "./node-migration-runner.js"
export {
  type AnalyzeProjectAdminConventionsInput,
  type CompiledProjectAdminConventions,
  PROJECT_ADMIN_CONVENTION_DIAGNOSTIC_CODES,
  type ProjectAdminConventionAnalysis,
  type ProjectAdminConventionDiagnostic,
  type ProjectAdminConventionDiagnosticCode,
  type ProjectAdminConventionEntry,
  ProjectAdminConventionError,
  type ProjectAdminGeneratedFile,
  VOYANT_PROJECT_ADMIN_GENERATED_FILE,
} from "./project-admin-conventions.js"
export type {
  ProjectApiConventionAnalysis,
  ProjectApiConventionCompilation,
  ProjectApiConventionDiagnostic,
  ProjectApiConventionDiagnosticCode,
  ProjectApiConventionRoute,
  ProjectApiConventionsOptions,
  ProjectApiGeneratedFile,
} from "./project-api-conventions.js"
export {
  type ProjectArtifactWriteEntry,
  type ProjectArtifactWriteMode,
  type ProjectArtifactWriteResult,
  type ProjectArtifactWriteStatus,
  type WriteResolvedProjectArtifactsInput,
  writeResolvedProjectArtifacts,
} from "./project-artifacts.js"
export type {
  DiscoverProjectConventionsInput,
  DiscoverProjectConventionsOptions,
  ProjectConventionApiRoute,
  ProjectConventionContribution,
  ProjectConventionDiagnostic,
  ProjectConventionDiagnosticCode,
  ProjectConventionDiscovery,
  ProjectConventionFileContribution,
  ProjectConventionKind,
  ProjectConventionRouteSurface,
} from "./project-conventions.js"
export type {
  FrameworkGeneratedProjectFile,
  ResolvedProjectArtifacts,
  ResolvedVoyantProject,
  ResolvedVoyantProjectGraph,
  ResolveProjectInput,
  VoyantProjectMigration,
  VoyantProjectMigrationPlan,
  VoyantProjectSchemaMigration,
  VoyantProjectSetupMigration,
} from "./project-resolver.js"
export type {
  ProjectLinkConvention,
  ProjectSubscriberConvention,
  ProjectSubscriberLinkConventionAnalysis,
  ProjectSubscriberLinkConventionCompilation,
  ProjectSubscriberLinkConventionDiagnostic,
  ProjectSubscriberLinkConventionsOptions,
  ProjectSubscriberLinkDiagnosticCode,
  ProjectSubscriberLinkGeneratedFile,
} from "./project-subscriber-link-conventions.js"
export type {
  ProjectJobConvention,
  ProjectWorkflowConvention,
  ProjectWorkflowJobConventionAnalysis,
  ProjectWorkflowJobConventionCompilation,
  ProjectWorkflowJobConventionDiagnostic,
  ProjectWorkflowJobConventionDiagnosticCode,
  ProjectWorkflowJobConventionsOptions,
  ProjectWorkflowJobGeneratedFile,
} from "./project-workflow-job-conventions.js"

/** Application-owned differences from the standard Operator distribution. */
export interface DefineVoyantConfigInput extends OperatorDistributionDifferences {
  deployment?: DefineVoyantGraphProjectInput["deployment"]
  meta?: DefineVoyantGraphProjectInput["meta"]
}

/** Expand framework defaults into the explicit project consumed by resolvers. */
export function defineConfig(input: DefineVoyantConfigInput = {}): VoyantGraphProject {
  const distribution = mergeOperatorDistributionDefaults(input)

  return defineProject({
    ...distribution,
    ...(input.deployment ? { deployment: input.deployment } : {}),
    ...(input.meta ? { meta: input.meta } : {}),
  })
}

export async function discoverProjectConventions(
  input: import("./project-conventions.js").DiscoverProjectConventionsInput,
): Promise<import("./project-conventions.js").ProjectConventionDiscovery> {
  const conventions = await import("./project-conventions.js")
  return conventions.discoverProjectConventions(input)
}

export async function analyzeProjectApiConventions(
  options: import("./project-api-conventions.js").ProjectApiConventionsOptions,
): Promise<import("./project-api-conventions.js").ProjectApiConventionAnalysis> {
  const conventions = await import("./project-api-conventions.js")
  return conventions.analyzeProjectApiConventions(options)
}

export async function compileProjectApiConventions(
  options: import("./project-api-conventions.js").ProjectApiConventionsOptions,
): Promise<import("./project-api-conventions.js").ProjectApiConventionCompilation> {
  const conventions = await import("./project-api-conventions.js")
  return conventions.compileProjectApiConventions(options)
}

export async function analyzeProjectAdminConventions(
  input: import("./project-admin-conventions.js").AnalyzeProjectAdminConventionsInput,
): Promise<import("./project-admin-conventions.js").ProjectAdminConventionAnalysis> {
  const conventions = await import("./project-admin-conventions.js")
  return conventions.analyzeProjectAdminConventions(input)
}

export async function compileProjectAdminConventions(
  input: import("./project-admin-conventions.js").AnalyzeProjectAdminConventionsInput,
): Promise<import("./project-admin-conventions.js").CompiledProjectAdminConventions> {
  const conventions = await import("./project-admin-conventions.js")
  return conventions.compileProjectAdminConventions(input)
}

export async function analyzeProjectWorkflowJobConventions(
  options: import("./project-workflow-job-conventions.js").ProjectWorkflowJobConventionsOptions,
): Promise<import("./project-workflow-job-conventions.js").ProjectWorkflowJobConventionAnalysis> {
  const conventions = await import("./project-workflow-job-conventions.js")
  return conventions.analyzeProjectWorkflowJobConventions(options)
}

export async function compileProjectWorkflowJobConventions(
  options: import("./project-workflow-job-conventions.js").ProjectWorkflowJobConventionsOptions,
): Promise<
  import("./project-workflow-job-conventions.js").ProjectWorkflowJobConventionCompilation
> {
  const conventions = await import("./project-workflow-job-conventions.js")
  return conventions.compileProjectWorkflowJobConventions(options)
}

export async function analyzeProjectSubscriberLinkConventions(
  options: import("./project-subscriber-link-conventions.js").ProjectSubscriberLinkConventionsOptions,
): Promise<
  import("./project-subscriber-link-conventions.js").ProjectSubscriberLinkConventionAnalysis
> {
  const conventions = await import("./project-subscriber-link-conventions.js")
  return conventions.analyzeProjectSubscriberLinkConventions(options)
}

export async function compileProjectSubscriberLinkConventions(
  options: import("./project-subscriber-link-conventions.js").ProjectSubscriberLinkConventionsOptions,
): Promise<
  import("./project-subscriber-link-conventions.js").ProjectSubscriberLinkConventionCompilation
> {
  const conventions = await import("./project-subscriber-link-conventions.js")
  return conventions.compileProjectSubscriberLinkConventions(options)
}

export async function executeNodeMigrationPlan(
  plan: import("./project-resolver.js").VoyantProjectMigrationPlan,
  runtime: import("./node-migration-runner.js").NodeMigrationRuntime,
  options?: import("./node-migration-runner.js").NodeMigrationRunnerOptions,
): Promise<import("./node-migration-runner.js").NodeMigrationExecutionReport> {
  const runner = await import("./node-migration-runner.js")
  return runner.executeNodeMigrationPlan(plan, runtime, options)
}

export async function createProjectMigrationPlan(
  graph: import("./deployment-graph.js").ResolvedVoyantDeploymentGraph,
): Promise<import("./project-resolver.js").VoyantProjectMigrationPlan> {
  const resolver = await import("./project-resolver.js")
  return resolver.buildMigrationPlan(graph)
}

export async function resolveProject(
  input: import("./project-resolver.js").ResolveProjectInput,
): Promise<import("./project-resolver.js").ResolvedVoyantProject> {
  const resolver = await import("./project-resolver.js")
  return resolver.resolveProject(input)
}
