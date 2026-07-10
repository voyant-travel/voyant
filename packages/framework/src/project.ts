export * from "@voyant-travel/core/project"
export type {
  NodeMigrationExecutionReport,
  NodeMigrationRunnerOptions,
  SetupMigrationHandler,
} from "./node-migration-runner.js"
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
