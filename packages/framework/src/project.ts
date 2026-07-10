export * from "@voyant-travel/core/project"

export type {
  FrameworkGeneratedProjectFile,
  ResolvedProjectArtifacts,
  ResolvedVoyantProject,
  ResolvedVoyantProjectGraph,
  ResolveProjectInput,
  VoyantProjectMigration,
  VoyantProjectMigrationPlan,
} from "./project-resolver.js"

export async function resolveProject(
  input: import("./project-resolver.js").ResolveProjectInput,
): Promise<import("./project-resolver.js").ResolvedVoyantProject> {
  const resolver = await import("./project-resolver.js")
  return resolver.resolveProject(input)
}
