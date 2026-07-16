import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"
import type { ApiModule } from "@voyant-travel/hono/module"
import { createCustomFieldRoutes } from "./routes.js"
import { createCustomFieldTargetRegistry } from "./targets.js"

export const createCustomFieldsApiModule = defineGraphRuntimeFactory(async ({ graph }) => {
  const targets = createCustomFieldTargetRegistry(graph.customFieldTargets ?? [])
  return {
    module: { name: "custom-fields" },
    adminRoutes: createCustomFieldRoutes(targets),
  } satisfies ApiModule
})
