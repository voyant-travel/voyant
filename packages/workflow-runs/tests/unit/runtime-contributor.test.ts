import { describe, expect, it } from "vitest"

import { WorkflowRunnerRegistry, workflowRunnerRegistryService } from "../../src/runner.js"
import { createWorkflowRunsRuntimePortContribution } from "../../src/runtime-contributor.js"
import {
  type WorkflowRunnerRegistryRuntime,
  workflowRunnerRegistryRuntimePort,
} from "../../src/runtime-port.js"

describe("Workflow Runs runtime contributor", () => {
  it("owns the concrete selected-graph runner registry", () => {
    const contribution = createWorkflowRunsRuntimePortContribution(undefined)
    const registry = contribution[
      workflowRunnerRegistryRuntimePort.id
    ] as WorkflowRunnerRegistryRuntime
    const runner = createRunner("selected")

    expect(registry).toBeInstanceOf(WorkflowRunnerRegistry)
    registry.register(runner)
    expect(registry.get("selected")).toBe(runner)
    expect(() => workflowRunnerRegistryRuntimePort.test?.(registry)).not.toThrow()
  })

  it("keeps direct registration bridged to the active package registry", () => {
    const contribution = createWorkflowRunsRuntimePortContribution(undefined)
    const registry = contribution[
      workflowRunnerRegistryRuntimePort.id
    ] as WorkflowRunnerRegistryRuntime
    const runner = createRunner("manual-bridge")

    workflowRunnerRegistryService.register(runner)

    expect(registry.get("manual-bridge")).toBe(runner)
  })
})

function createRunner(name: string) {
  return {
    name,
    idempotency: "safe" as const,
    rerun: async () => ({ runId: `${name}-rerun` }),
    resume: async () => ({ runId: `${name}-resume` }),
  }
}
