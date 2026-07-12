import {
  type WorkflowRunnerRegistryRuntime,
  workflowRunnerRegistryRuntimePort,
} from "./runtime-port.js"

/** Package-owned optional registration for the process-local workflow runner registry. */
export function createWorkflowRunsRuntimePortContribution(host: {
  workflowRunnerRegistry?: WorkflowRunnerRegistryRuntime
}): Readonly<Record<string, unknown>> {
  return host.workflowRunnerRegistry
    ? { [workflowRunnerRegistryRuntimePort.id]: host.workflowRunnerRegistry }
    : {}
}
