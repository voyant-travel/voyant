import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"
import {
  type CustomFieldValueLifecycleRuntime,
  customFieldValueLifecycleRuntimePort,
} from "@voyant-travel/core/runtime-port"
import type { ApiModule } from "@voyant-travel/hono/module"
import { createCustomFieldRoutes } from "./routes.js"
import { createCustomFieldTargetRegistry } from "./targets.js"

export const createCustomFieldsApiModule = defineGraphRuntimeFactory(
  async ({ getPorts, graph }) => {
    const targets = createCustomFieldTargetRegistry(graph.customFieldTargets ?? [])
    const valueLifecycles = await getPorts<CustomFieldValueLifecycleRuntime>(
      customFieldValueLifecycleRuntimePort,
    )
    return {
      module: { name: "custom-fields" },
      adminRoutes: createCustomFieldRoutes(targets, { valueLifecycles }),
    } satisfies ApiModule
  },
)
