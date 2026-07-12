import type { CatalogRuntimeServices } from "@voyant-travel/catalog/runtime-contracts"
import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import type { ChannelPushRuntime } from "./channel-push/runtime-port.js"
import { createChannelPushWorkflowRuntimeEntries } from "./channel-push/workflow-entry.js"

/** Create Distribution's channel-push runtime from graph-selected host services. */
export function createDistributionRuntime(
  primitives: VoyantRuntimeHostPrimitives,
  catalogRuntime: CatalogRuntimeServices,
): ChannelPushRuntime {
  return {
    resolveRegistry: (context) => catalogRuntime.getSourceRegistryFromContext(context),
    async registerWorkflowService({ container, bindings }) {
      const entries = await createChannelPushWorkflowRuntimeEntries({
        resolveDb: () => primitives.database.resolve<AnyDrizzleDb>(bindings),
        withDb: (operation) =>
          primitives.database.transaction(bindings, (database) =>
            operation(database as AnyDrizzleDb),
          ),
        resolveRegistry: () => catalogRuntime.ensureSourceRegistry(primitives.env(bindings)),
      })
      for (const [key, runtime] of entries) container.register(key, runtime)
    },
  }
}
