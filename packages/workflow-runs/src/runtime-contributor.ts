import {
  type WorkflowRunnerRegistryRuntime,
  workflowRunnerRegistryRuntimePort,
} from "./runtime-port.js"

/** Package-owned optional registration for the process-local workflow runner registry. */
export function createWorkflowRunsRuntimePortContribution(
  registry?: WorkflowRunnerRegistryRuntime,
): Readonly<Record<string, unknown>> {
  return registry ? { [workflowRunnerRegistryRuntimePort.id]: registry } : {}
}
