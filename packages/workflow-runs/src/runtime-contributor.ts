import { workflowRunnerRegistryService } from "./runner.js"
import { workflowRunnerRegistryRuntimePort } from "./runtime-port.js"

/** Package-owned registration for the process-local workflow runner registry service. */
export function createWorkflowRunsRuntimePortContribution(
  _host: unknown,
): Readonly<Record<string, unknown>> {
  return { [workflowRunnerRegistryRuntimePort.id]: workflowRunnerRegistryService }
}
