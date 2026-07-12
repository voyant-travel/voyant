import {
  loadVoyantNodeDeploymentGraphArtifacts,
  type VoyantNodeDeploymentGraphArtifactSummary,
} from "@voyant-travel/framework/node-host"

export {
  assertVoyantNodeDeploymentGraphResourceEnv,
  type VoyantNodeDeploymentGraphEnv,
  type VoyantNodeDeploymentGraphEnvRequirement,
  type VoyantNodeDeploymentGraphMigrationSource,
  type VoyantNodeDeploymentGraphResourceRequirement,
  type VoyantNodeDeploymentGraphScheduledJob,
  validateVoyantNodeDeploymentGraphResourceEnv,
} from "@voyant-travel/framework/node-host"

/** Resolve generated artifacts relative to this application, not the framework package. */
export function loadDeploymentGraphArtifacts(
  baseUrl = import.meta.url,
): VoyantNodeDeploymentGraphArtifactSummary {
  return loadVoyantNodeDeploymentGraphArtifacts(baseUrl)
}
