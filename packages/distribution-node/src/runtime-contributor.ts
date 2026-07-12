import {
  type CatalogRuntimeServices,
  catalogRuntimeServicesPort,
} from "@voyant-travel/catalog/runtime-contracts"
import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import { channelPushRuntimePort } from "@voyant-travel/distribution"

export interface DistributionNodeRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
}

/** Supply Distribution channel-push through the standard Node target adapter. */
export function createDistributionNodeRuntimePortContribution(
  host: DistributionNodeRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const runtime = Promise.all([
    import("./standard-node-runtime.js"),
    host.primitives.modules.import<{
      createCatalogRuntimePortContribution(
        input: DistributionNodeRuntimeContributorHost,
      ): Readonly<Record<string, unknown>>
    }>("@voyant-travel/catalog/runtime-contributor"),
  ]).then(async ([module, catalog]) => {
    const ports = catalog.createCatalogRuntimePortContribution(host)
    const services = (await ports[catalogRuntimeServicesPort.id]) as CatalogRuntimeServices
    module.configureDistributionStandardNodeRuntime(host.primitives, services)
    return module.distributionStandardNodeRuntime
  })
  return { [channelPushRuntimePort.id]: runtime }
}
