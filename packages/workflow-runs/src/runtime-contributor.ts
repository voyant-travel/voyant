import { WorkflowRunnerRegistry } from "./runner.js"
import { workflowRunnerRegistryRuntimePort } from "./runtime-port.js"

/** Package-owned provider for the process-local workflow runner registry. */
export function createWorkflowRunsRuntimePortContribution(
  _host: unknown,
): Readonly<Record<string, unknown>> {
  return { [workflowRunnerRegistryRuntimePort.id]: new WorkflowRunnerRegistry() }
}
