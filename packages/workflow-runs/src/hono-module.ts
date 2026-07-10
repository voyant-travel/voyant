import { OpenAPIHono } from "@hono/zod-openapi"
import { openApiValidationHook } from "@voyant-travel/hono"
import type { HonoModule } from "@voyant-travel/hono/module"

import type { MountWorkflowRunsAdminRoutesOptions } from "./routes.js"

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
