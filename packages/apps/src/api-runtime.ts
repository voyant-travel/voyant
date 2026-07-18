import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"
import {
  type CustomFieldValueLifecycleRuntime,
  type CustomFieldValueOperationsRuntime,
  customFieldValueLifecycleRuntimePort,
  customFieldValueOperationsRuntimePort,
} from "@voyant-travel/core/runtime-port"
import { createCustomFieldTargetRegistry } from "@voyant-travel/custom-fields"
import { financeAppApiRuntimePort } from "@voyant-travel/finance-contracts/app-api"
import type { ApiModule } from "@voyant-travel/hono/module"
import { createAppsAppApiRoutes } from "./app-api-routes.js"
import { createAppsAdminRoutes } from "./routes.js"

export const createAppsApiModule = defineGraphRuntimeFactory(
  async ({ getPort, getPorts, graph, hasPort }) => {
    const customFieldTargets = createCustomFieldTargetRegistry(graph.customFieldTargets ?? [])
    const customFieldValueLifecycles = await getPorts<CustomFieldValueLifecycleRuntime>(
      customFieldValueLifecycleRuntimePort,
    )
    const customFieldValueOperations = await getPorts<CustomFieldValueOperationsRuntime>(
      customFieldValueOperationsRuntimePort,
    )
    const finance = hasPort(financeAppApiRuntimePort)
      ? await getPort(financeAppApiRuntimePort)
      : undefined
    return {
      module: { name: "apps" },
      adminRoutes: createAppsAdminRoutes({ eventCatalog: graph.eventCatalog }),
      lazyRoutes: {
        paths: ["/v1/app", "/v1/app/*"],
        load: async () =>
          createAppsAppApiRoutes({
            customFieldTargets,
            customFieldValueLifecycles,
            customFieldValueOperations,
            finance,
          }),
      },
    } satisfies ApiModule
  },
)
