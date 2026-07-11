import { definePort } from "@voyant-travel/core/project"

import type { WorkflowRunner } from "./runner.js"

export interface WorkflowRunnerRegistryRuntime {
  register(runner: WorkflowRunner): void
}

/** Process-owned registry used by package runtimes to expose rerun/resume handlers. */
export const workflowRunnerRegistryRuntimePort = definePort<WorkflowRunnerRegistryRuntime>({
  id: "workflows.runner-registry",
  test(provider) {
    if (
      provider === null ||
      typeof provider !== "object" ||
      typeof provider.register !== "function"
    ) {
      throw new Error("workflows.runner-registry provider must implement register().")
    }
  },
})
