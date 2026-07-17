import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"
import type { ApiModule } from "@voyant-travel/hono/module"
import { createAppsAdminRoutes } from "./routes.js"

export const createAppsApiModule = defineGraphRuntimeFactory(async ({ graph }) => {
  return {
    module: { name: "apps" },
    adminRoutes: createAppsAdminRoutes({ eventCatalog: graph.eventCatalog }),
  } satisfies ApiModule
})
