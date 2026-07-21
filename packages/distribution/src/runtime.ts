import type { CatalogRuntimeServices } from "@voyant-travel/catalog/runtime-contracts"
import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import type { ChannelPushRuntime } from "./channel-push/runtime-port.js"
import { CHANNEL_PUSH_RUNTIME_KEY, type ChannelPushDeps } from "./channel-push/types.js"

/** Create Distribution's channel-push runtime from graph-selected host services. */
export function createDistributionRuntime(
  primitives: VoyantRuntimeHostPrimitives,
  catalogRuntime: CatalogRuntimeServices,
): ChannelPushRuntime {
  const resolveRegistry = () => catalogRuntime.ensureSourceRegistry(primitives.env(undefined))
  return {
    resolveRegistry: (context) => catalogRuntime.getSourceRegistryFromContext(context),
    async registerSubscriberRuntime({ container, bindings }) {
      const deps: ChannelPushDeps = {
        db: primitives.database.resolve<AnyDrizzleDb>(bindings),
        registry: await catalogRuntime.ensureSourceRegistry(primitives.env(bindings)),
      }
      container.register(CHANNEL_PUSH_RUNTIME_KEY, deps)
    },
    withDeps: async (operation) =>
      operation({
        db: primitives.database.resolve<AnyDrizzleDb>(undefined),
        registry: await resolveRegistry(),
      }),
  }
}
