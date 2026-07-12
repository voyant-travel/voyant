import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import { channelPushRuntimePort } from "@voyant-travel/distribution"

export interface DistributionNodeRuntimeContributorHost {
  primitives: VoyantRuntimeHostPrimitives
}

/** Supply Distribution channel-push through the standard Node target adapter. */
export function createDistributionNodeRuntimePortContribution(
  host: DistributionNodeRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  const runtime = import("./standard-node-runtime.js").then((module) => {
    module.configureDistributionStandardNodeRuntime(host.primitives)
    return module.distributionStandardNodeRuntime
  })
  return { [channelPushRuntimePort.id]: runtime }
}
