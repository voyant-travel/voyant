import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"
import {
  type CustomFieldValueLifecycleRuntime,
  type CustomFieldValueOperationsRuntime,
  customFieldValueLifecycleRuntimePort,
  customFieldValueOperationsRuntimePort,
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
    const valueOperations = await getPorts<CustomFieldValueOperationsRuntime>(
      customFieldValueOperationsRuntimePort,
    )
    return {
      module: { name: "custom-fields" },
      adminRoutes: createCustomFieldRoutes(targets, { valueLifecycles, valueOperations }),
    } satisfies ApiModule
  },
)
