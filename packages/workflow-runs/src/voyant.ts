import { defineModule, definePort, requirePort } from "@voyant-travel/core/project"

import type { WorkflowRunner } from "./runner.js"

export interface WorkflowRunnerRegistryRuntime {
  register(runner: WorkflowRunner): void
  get(name: string): WorkflowRunner | null
}

/** Process-owned registry used by package runtimes to expose rerun/resume handlers. */
export const workflowRunnerRegistryRuntimePort = definePort<WorkflowRunnerRegistryRuntime>({
  id: "workflows.runner-registry",
  test(provider) {
    if (
      provider === null ||
      typeof provider !== "object" ||
      typeof provider.register !== "function" ||
      typeof provider.get !== "function"
    ) {
      throw new Error("workflows.runner-registry provider must implement register() and get().")
    }
  },
})

/** Import-cheap deployment declaration owned by the workflow-runs package. */
export const workflowRunsVoyantModule = defineModule({
  id: "@voyant-travel/workflow-runs",
  packageName: "@voyant-travel/workflow-runs",
  localId: "workflow-runs",
  runtimePorts: [requirePort(workflowRunnerRegistryRuntimePort)],
  api: [
    {
      id: "@voyant-travel/workflow-runs#api.admin",
      surface: "admin",
      mount: "workflow-runs",
      openapi: { document: "workflow-runs" },
      runtime: {
        entry: "@voyant-travel/workflow-runs/hono-module",
        export: "createWorkflowRunsVoyantRuntime",
      },
    },
  ],
  schema: [
    {
      id: "@voyant-travel/workflow-runs#schema",
      source: "@voyant-travel/workflow-runs/schema",
    },
  ],
  migrations: [
    {
      id: "@voyant-travel/workflow-runs#migrations",
      source: "./migrations",
    },
  ],
  resources: [
    {
      id: "@voyant-travel/workflow-runs#resource.database",
      kind: "database",
      required: true,
      config: { engine: "postgres" },
    },
  ],
  access: {
    resources: [
      {
        id: "@voyant-travel/workflow-runs#access.workflows",
        resource: "workflows",
        actions: ["trigger"],
      },
      {
        id: "@voyant-travel/workflow-runs#access.webhooks",
        resource: "webhooks",
        actions: ["relay"],
      },
    ],
  },
  lifecycle: {
    uninstall: { default: "retain-data", purge: "not-supported" },
  },
  meta: {
    ownership: "package",
  },
})

export default workflowRunsVoyantModule
