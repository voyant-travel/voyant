import { describe, expect, it } from "vitest"

import {
  createWorkflowRunsHonoModule,
  WORKFLOW_RUNS_ADMIN_ROUTE_PATHS,
} from "../../src/hono-module.js"
import { workflowRunsVoyantModule } from "../../src/voyant.js"

describe("workflow-runs deployment manifest", () => {
  it("owns the mounted admin runtime, schema, and migrations", () => {
    expect(workflowRunsVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/workflow-runs",
      packageName: "@voyant-travel/workflow-runs",
      api: [
        {
          id: "@voyant-travel/workflow-runs#api.admin",
          surface: "admin",
          mount: "workflow-runs",
          runtime: {
            entry: "@voyant-travel/workflow-runs/hono-module",
            export: "createWorkflowRunsHonoModule",
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
    })
  })

  it("exports a runtime factory for the existing absolute admin routes", () => {
    const runtime = createWorkflowRunsHonoModule()

    expect(runtime.module.name).toBe("workflow-runs")
    expect(runtime.adminRoutes).toBeUndefined()
    expect(runtime.publicRoutes).toBeUndefined()
    expect(runtime.lazyRoutes?.paths).toEqual(WORKFLOW_RUNS_ADMIN_ROUTE_PATHS)
  })
})
