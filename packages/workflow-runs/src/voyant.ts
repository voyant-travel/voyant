import { defineModule, definePort, providePort, requirePort } from "@voyant-travel/core/project"

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
  provides: { ports: [providePort(workflowRunnerRegistryRuntimePort)] },
  runtimePorts: [requirePort(workflowRunnerRegistryRuntimePort)],
  api: [
    {
      id: "@voyant-travel/workflow-runs#api.admin",
      surface: "admin",
      mount: "workflow-runs",
      resource: "workflows",
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
        label: "Workflows",
        description: "Inspect, trigger, and retry workflow runs.",
        wildcard: "explicit-resource",
        actions: [
          {
            action: "read",
            label: "View workflow runs",
            description: "View workflow-run summaries, inputs, results, errors, and steps.",
          },
          {
            action: "trigger",
            label: "Trigger workflows",
            description: "Trigger registered workflows.",
            sensitive: true,
            wildcard: "explicit",
          },
          {
            action: "retry",
            label: "Retry workflow runs",
            description: "Rerun workflows from the beginning or resume failed runs.",
            sensitive: true,
            wildcard: "explicit",
          },
        ],
      },
      {
        id: "@voyant-travel/workflow-runs#access.webhooks",
        resource: "webhooks",
        label: "Webhooks",
        description: "Relay workflow events to configured webhook destinations.",
        actions: [
          {
            action: "relay",
            label: "Relay webhooks",
            description: "Relay workflow events to external webhook destinations.",
            sensitive: true,
          },
        ],
      },
    ],
  },
  tools: [
    {
      id: "@voyant-travel/workflow-runs#tool.list-runs",
      name: "list_workflow_runs",
      runtime: {
        entry: "@voyant-travel/workflow-runs/tools",
        export: "listWorkflowRunsTool",
      },
      requiredScopes: ["workflows:read"],
      context: ["workflowRuns"],
      risk: "medium",
    },
    {
      id: "@voyant-travel/workflow-runs#tool.get-run",
      name: "get_workflow_run",
      runtime: {
        entry: "@voyant-travel/workflow-runs/tools",
        export: "getWorkflowRunTool",
      },
      requiredScopes: ["workflows:read"],
      context: ["workflowRuns"],
      risk: "medium",
    },
    {
      id: "@voyant-travel/workflow-runs#tool.trigger",
      name: "trigger_workflow",
      runtime: {
        entry: "@voyant-travel/workflow-runs/tools",
        export: "triggerWorkflowTool",
      },
      requiredScopes: ["workflows:trigger"],
      context: ["workflowRuns"],
      risk: "critical",
    },
    {
      id: "@voyant-travel/workflow-runs#tool.retry",
      name: "retry_workflow_run",
      runtime: {
        entry: "@voyant-travel/workflow-runs/tools",
        export: "retryWorkflowRunTool",
      },
      requiredScopes: ["workflows:retry"],
      context: ["workflowRuns"],
      risk: "critical",
    },
  ],
  actions: [
    {
      id: "@voyant-travel/workflow-runs#action.list-runs",
      version: "v1",
      kind: "sensitive-read",
      targetType: "workflow-run",
      resource: "workflows",
      action: "read",
      requiredScopes: ["workflows:read"],
      risk: "medium",
      ledger: "required",
      approval: "never",
      allowedActorTypes: ["staff"],
      from: { tools: ["@voyant-travel/workflow-runs#tool.list-runs"] },
    },
    {
      id: "@voyant-travel/workflow-runs#action.get-run",
      version: "v1",
      kind: "sensitive-read",
      targetType: "workflow-run",
      resource: "workflows",
      action: "read",
      requiredScopes: ["workflows:read"],
      risk: "medium",
      ledger: "required",
      approval: "never",
      allowedActorTypes: ["staff"],
      from: { tools: ["@voyant-travel/workflow-runs#tool.get-run"] },
    },
    {
      id: "@voyant-travel/workflow-runs#action.trigger",
      version: "v1",
      kind: "execute",
      targetType: "workflow-run",
      resource: "workflows",
      action: "trigger",
      requiredScopes: ["workflows:trigger"],
      risk: "critical",
      ledger: "required",
      approval: "required",
      reversible: false,
      allowedActorTypes: ["staff"],
      from: { tools: ["@voyant-travel/workflow-runs#tool.trigger"] },
    },
    {
      id: "@voyant-travel/workflow-runs#action.retry",
      version: "v1",
      kind: "execute",
      targetType: "workflow-run",
      resource: "workflows",
      action: "retry",
      requiredScopes: ["workflows:retry"],
      risk: "critical",
      ledger: "required",
      approval: "required",
      reversible: false,
      allowedActorTypes: ["staff"],
      from: { tools: ["@voyant-travel/workflow-runs#tool.retry"] },
    },
  ],
  lifecycle: {
    uninstall: { default: "retain-data", purge: "not-supported" },
  },
  meta: {
    ownership: "package",
  },
})

export default workflowRunsVoyantModule
