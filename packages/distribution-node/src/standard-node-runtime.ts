import type { CatalogRuntimeServices } from "@voyant-travel/catalog/runtime-contracts"
import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import type { ChannelPushRuntime } from "@voyant-travel/distribution"
import { createChannelPushWorkflowRuntimeEntries } from "@voyant-travel/distribution/channel-push-workflows"

let runtimePrimitives: VoyantRuntimeHostPrimitives | undefined
let catalogRuntime: CatalogRuntimeServices | undefined

/** Bind generic Node host resources selected by generated graph composition. */
export function configureDistributionStandardNodeRuntime(
  primitives: VoyantRuntimeHostPrimitives,
  services: CatalogRuntimeServices,
): void {
  runtimePrimitives = primitives
  catalogRuntime = services
}

function requireCatalogRuntime(): CatalogRuntimeServices {
  if (!catalogRuntime) throw new Error("Distribution Catalog runtime is not configured")
  return catalogRuntime
}

function requirePrimitives(): VoyantRuntimeHostPrimitives {
  if (!runtimePrimitives) {
    throw new Error("Distribution standard Node runtime has not been configured")
  }
  return runtimePrimitives
}

/** Standard Node channel-push provider shared by generated and compatibility entrypoints. */
export const distributionStandardNodeRuntime: ChannelPushRuntime = {
  resolveRegistry: (context) => requireCatalogRuntime().getSourceRegistryFromContext(context),
  async registerWorkflowService({ container, bindings }) {
    const primitives = requirePrimitives()
    const entries = await createChannelPushWorkflowRuntimeEntries({
      resolveDb: () => primitives.database.resolve<AnyDrizzleDb>(bindings),
      withDb: (operation) =>
        primitives.database.transaction(bindings, (database) =>
          operation(database as AnyDrizzleDb),
        ),
      resolveRegistry: () => requireCatalogRuntime().ensureSourceRegistry(primitives.env(bindings)),
    })
    for (const [key, runtime] of entries) container.register(key, runtime)
  },
}
