import {
  ensureBookingEngineRegistry,
  getBookingEngineRegistryFromContext,
} from "@voyant-travel/catalog-node/standard-node/booking-engine-runtime"
import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import type { ChannelPushRuntime } from "@voyant-travel/distribution"
import { createChannelPushWorkflowRuntimeEntries } from "@voyant-travel/distribution/channel-push-workflows"

let runtimePrimitives: VoyantRuntimeHostPrimitives | undefined

/** Bind generic Node host resources selected by generated graph composition. */
export function configureDistributionStandardNodeRuntime(
  primitives: VoyantRuntimeHostPrimitives,
): void {
  runtimePrimitives = primitives
}

function requirePrimitives(): VoyantRuntimeHostPrimitives {
  if (!runtimePrimitives) {
    throw new Error("Distribution standard Node runtime has not been configured")
  }
  return runtimePrimitives
}

/** Standard Node channel-push provider shared by generated and compatibility entrypoints. */
export const distributionStandardNodeRuntime: ChannelPushRuntime = {
  resolveRegistry: getBookingEngineRegistryFromContext,
  async registerWorkflowService({ container, bindings }) {
    const primitives = requirePrimitives()
    const entries = await createChannelPushWorkflowRuntimeEntries({
      resolveDb: () => primitives.database.resolve<AnyDrizzleDb>(bindings),
      withDb: (operation) =>
        primitives.database.transaction(bindings, (database) =>
          operation(database as AnyDrizzleDb),
        ),
      resolveRegistry: () => ensureBookingEngineRegistry(primitives.env(bindings)),
    })
    for (const [key, runtime] of entries) container.register(key, runtime)
  },
}
