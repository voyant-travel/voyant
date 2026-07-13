import { OpenAPIHono } from "@hono/zod-openapi"
import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"
import { openApiValidationHook } from "@voyant-travel/hono"
import type { HonoModule } from "@voyant-travel/hono/module"

import type { MountWorkflowRunsAdminRoutesOptions } from "./routes.js"
import { workflowRunnerRegistryRuntimePort } from "./runtime-port.js"

export const WORKFLOW_RUNS_ADMIN_ROUTE_PATHS = [
  "/v1/admin/workflow-runs",
  "/v1/admin/workflow-runs/*",
  "/v1/admin/workflows/:name/runs",
] as const

/** Build the workflow-runs absolute admin route family for deployment composition. */
export function createWorkflowRunsHonoModule(
  options: MountWorkflowRunsAdminRoutesOptions = {},
): HonoModule {
  return {
    module: { name: "workflow-runs" },
    lazyRoutes: {
      paths: WORKFLOW_RUNS_ADMIN_ROUTE_PATHS,
      load: async () => {
        const { mountWorkflowRunsAdminRoutes } = await import("./routes.js")
        const app = new OpenAPIHono({ defaultHook: openApiValidationHook })
        mountWorkflowRunsAdminRoutes(app, options)
        return app
      },
    },
  }
}

/** Package-owned adapter from the selected runner-registry port to admin routes. */
export const createWorkflowRunsVoyantRuntime = defineGraphRuntimeFactory(async ({ getPort }) =>
  createWorkflowRunsHonoModule({
    runners: await getPort(workflowRunnerRegistryRuntimePort),
    resolveUserId: (context) => {
      const userId = (context as { get(key: string): unknown }).get("userId")
      return typeof userId === "string" ? userId : null
    },
  }),
)
