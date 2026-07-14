import { describe, expect, it } from "vitest"

import {
  createWorkflowRunsHonoModule,
  WORKFLOW_RUNS_ADMIN_ROUTE_PATHS,
} from "../../src/hono-module.js"
import { workflowRunnerRegistryRuntimePort } from "../../src/runtime-port.js"
import { workflowRunsVoyantModule } from "../../src/voyant.js"

describe("workflow-runs deployment manifest", () => {
  it("owns the mounted admin runtime, schema, and migrations", () => {
    expect(workflowRunsVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/workflow-runs",
      packageName: "@voyant-travel/workflow-runs",
      runtimePorts: [{ id: workflowRunnerRegistryRuntimePort.id }],
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
      resources: [{ id: "@voyant-travel/workflow-runs#resource.database", kind: "database" }],
      access: {
        resources: [
          {
            id: "@voyant-travel/workflow-runs#access.workflows",
            resource: "workflows",
            label: "Workflows",
            description: "Trigger and resume workflow runs.",
            actions: [
              {
                action: "trigger",
                label: "Trigger workflows",
                description: "Trigger, rerun, and resume workflow runs.",
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

  it("exports a runtime factory for the existing absolute admin routes", () => {
    const runtime = createWorkflowRunsHonoModule()

    expect(runtime.module.name).toBe("workflow-runs")
    expect(runtime.adminRoutes).toBeUndefined()
    expect(runtime.publicRoutes).toBeUndefined()
    expect(runtime.lazyRoutes?.paths).toEqual(WORKFLOW_RUNS_ADMIN_ROUTE_PATHS)
  })
})
