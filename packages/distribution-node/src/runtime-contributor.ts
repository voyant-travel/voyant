import {
  type CatalogRuntimeServices,
  catalogRuntimeServicesPort,
} from "@voyant-travel/catalog/runtime-contracts"
import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import type { VoyantPort } from "@voyant-travel/core/project"
import { channelPushRuntimePort } from "@voyant-travel/distribution"
import {
  configureDistributionStandardNodeRuntime,
  distributionStandardNodeRuntime,
} from "./standard-node-runtime.js"

export interface DistributionNodeRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
  getRuntimePort<T>(port: Pick<VoyantPort<T>, "id">): T | Promise<T>
}

/** Supply Distribution channel-push through the standard Node target adapter. */
export function createDistributionNodeRuntimePortContribution(
  host: DistributionNodeRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const runtime = Promise.resolve()
    .then(() => host.getRuntimePort(catalogRuntimeServicesPort))
    .then((services: CatalogRuntimeServices) => {
      configureDistributionStandardNodeRuntime(host.primitives, services)
      return distributionStandardNodeRuntime
    })
  return { [channelPushRuntimePort.id]: runtime }
}
