/**
 * @deprecated Snapshot-era bridge to the deployment graph.
 * New applications author a graph project directly and resolve it through the project resolver.
 */
import { definePlugin, defineProject, type VoyantGraphProject } from "@voyant-travel/core/project"
import {
  defineDeployment,
  generateCustomSourceExtensionManifests,
  generateCustomSourceModuleManifests,
  generateFrameworkExtensionManifests,
  generateFrameworkModuleManifests,
  generateWorkspacePackageRecords,
  graphIdFromSpecifier,
  packageNameFromSpecifier,
  type ResolveDeploymentGraphInput,
  type ResolvedVoyantDeploymentGraph,
  resolveDeploymentGraph,
  type VoyantGraphDeployment,
} from "./deployment-graph.js"
import { getManagedProfileScheduledJobs } from "./managed-jobs.js"
import {
  getVoyantProjectProviders,
  toCreateVoyantAppProfileConfig,
  type VoyantProjectManifest,
} from "./profile.js"
import { moduleIdFromSpecifier } from "./profile-types.js"

/** @deprecated Author a VoyantGraphProject directly. */
export function defineProjectFromManagedProfile(
  project: VoyantProjectManifest,
): VoyantGraphProject {
  const bridge = toCreateVoyantAppProfileConfig(project)
  return defineProject({
    presetLineage: `${project.profile}-standard`,
    modules: [
      ...generateFrameworkModuleManifests(bridge.manifest.modules),
      ...generateCustomSourceModuleManifests(project.customSource?.modules),
    ],
    extensions: [
      ...generateFrameworkExtensionManifests(bridge.manifest.extensions),
      ...generateCustomSourceExtensionManifests(project.customSource?.extensions),
    ],
    plugins: project.plugins.map((specifier) =>
      definePlugin({
        id: graphIdFromSpecifier(specifier),
        packageName: packageNameFromSpecifier(specifier),
        localId: moduleIdFromSpecifier(specifier),
      }),
    ),
    meta: {
      compatibilityProfile: project.profile,
      managedProfileSchemaVersion: project.schemaVersion,
      frameworkVersion: project.frameworkVersion,
    },
  })
}

/** @deprecated Author graph deployment settings directly. */
export function defineDeploymentFromManagedProfile(
  project: VoyantProjectManifest,
): VoyantGraphDeployment {
  const providers = getVoyantProjectProviders(project)
  return defineDeployment({
    project: defineProjectFromManagedProfile(project),
    target: "node",
    mode: project.mode,
    providers: { ...providers },
    meta: {
      compatibilityProfile: project.profile,
      frameworkVersion: project.frameworkVersion,
    },
  })
}

/** @deprecated Resolve a graph-native project through the project resolver. */
export async function resolveManagedProfileDeploymentGraph(
  project: VoyantProjectManifest,
  options: Omit<ResolveDeploymentGraphInput, "project" | "deployment"> = {},
): Promise<ResolvedVoyantDeploymentGraph> {
  const deployment = defineDeploymentFromManagedProfile(project)
  return resolveDeploymentGraph({
    ...options,
    project: deployment.project,
    deployment,
    packageRecords:
      options.packageRecords ??
      generateWorkspacePackageRecords(deployment.project, project.frameworkVersion),
    scheduledJobs: options.scheduledJobs ?? getManagedProfileScheduledJobs(project),
    frameworkVersion: options.frameworkVersion ?? project.frameworkVersion,
    target: options.target ?? deployment.target,
    mode: options.mode ?? deployment.mode,
  })
}
