import { OpenAPIHono } from "@hono/zod-openapi"
import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"
import { openApiValidationHook } from "@voyant-travel/hono"
import type { HonoModule } from "@voyant-travel/hono/module"

import type { MountWorkflowRunsAdminRoutesOptions, WorkflowAdminSurface } from "./routes.js"
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
export const createWorkflowRunsVoyantRuntime = defineGraphRuntimeFactory(
  async ({ graph, getPort }) =>
    createWorkflowRunsHonoModule({
      runners: await getPort(workflowRunnerRegistryRuntimePort),
      adminSurface: workflowAdminSurfaceForProvider(graph.providerSelections.workflows),
      resolveUserId: (context) => {
        const userId = (context as { get(key: string): unknown }).get("userId")
        return typeof userId === "string" ? userId : null
      },
    }),
)

function workflowAdminSurfaceForProvider(provider: string | undefined): WorkflowAdminSurface {
  if (provider === "self-hosted") return "tenant"
  if (provider === "voyant-cloud") return "cloud"
  if (provider === "none") return "disabled"
  throw new Error(
    `Unsupported deployment.providers.workflows value ${JSON.stringify(provider)} for Workflow Runs admin routes.`,
  )
}
