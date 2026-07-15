import { describe, expect, it } from "vitest"

import {
  createWorkflowRunsApiModule,
  WORKFLOW_RUNS_ADMIN_ROUTE_PATHS,
} from "../../src/api-runtime.js"
import { workflowRunnerRegistryRuntimePort } from "../../src/runtime-port.js"
import { workflowRunsVoyantModule } from "../../src/voyant.js"

describe("workflow-runs deployment manifest", () => {
  it("owns the mounted admin runtime, schema, and migrations", () => {
    expect(workflowRunsVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/workflow-runs",
      packageName: "@voyant-travel/workflow-runs",
      provides: { ports: [{ id: workflowRunnerRegistryRuntimePort.id }] },
      runtimePorts: [{ id: workflowRunnerRegistryRuntimePort.id }],
      api: [
        {
          id: "@voyant-travel/workflow-runs#api.admin",
          surface: "admin",
          mount: "workflow-runs",
          resource: "workflows",
          openapi: { document: "workflow-runs" },
          runtime: {
            entry: "@voyant-travel/workflow-runs/api-runtime",
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
      resources: [{ id: "@voyant-travel/workflow-runs#resource.database", kind: "database" }],
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
      lifecycle: { uninstall: { default: "retain-data", purge: "not-supported" } },
    })
    expect(workflowRunsVoyantModule.config).toBeUndefined()
  })

  it("binds scoped Tools to auditable staff-only graph actions", () => {
    expect(workflowRunsVoyantModule.tools?.map(({ name }) => name).sort()).toEqual([
      "get_workflow_run",
      "list_workflow_runs",
      "retry_workflow_run",
      "trigger_workflow",
    ])
    expect(workflowRunsVoyantModule.meta?.agentTools).toBeUndefined()

    const writes = workflowRunsVoyantModule.actions?.filter(({ kind }) => kind === "execute") ?? []
    expect(writes).toHaveLength(2)
    expect(
      writes.every(
        ({ risk, ledger, approval, reversible, allowedActorTypes, requiredScopes, from }) =>
          risk === "critical" &&
          ledger === "required" &&
          approval === "required" &&
          reversible === false &&
          allowedActorTypes?.join() === "staff" &&
          requiredScopes?.length === 1 &&
          from?.tools?.length === 1,
      ),
    ).toBe(true)
  })

  it("exports a runtime factory for the existing absolute admin routes", () => {
    const runtime = createWorkflowRunsApiModule()

    expect(runtime.module.name).toBe("workflow-runs")
    expect(runtime.adminRoutes).toBeUndefined()
    expect(runtime.publicRoutes).toBeUndefined()
    expect(runtime.lazyRoutes?.paths).toEqual(WORKFLOW_RUNS_ADMIN_ROUTE_PATHS)
  })
})
