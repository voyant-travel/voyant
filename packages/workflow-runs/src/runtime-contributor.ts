import {
  type WorkflowRunnerRegistryRuntime,
  workflowRunnerRegistryRuntimePort,
} from "./runtime-port.js"

/** Package-owned optional registration for the process-local workflow runner registry. */
export function createWorkflowRunsRuntimePortContribution(host: {
  capabilities: {
    resolveWorkflowRunnerRegistry(): WorkflowRunnerRegistryRuntime | undefined
  }
}): Readonly<Record<string, unknown>> {
  const registry = host.capabilities.resolveWorkflowRunnerRegistry()
  return registry ? { [workflowRunnerRegistryRuntimePort.id]: registry } : {}
}
