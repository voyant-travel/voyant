import { type ChannelPushRuntime, channelPushRuntimePort } from "./channel-push/runtime-port.js"

type RuntimePortValue<T> = T | Promise<T>

export interface DistributionRuntimePortContribution {
  channelPush: RuntimePortValue<ChannelPushRuntime>
}

export interface DistributionRuntimeContributorHost {
  capabilities: {
    loadDistributionChannelPushRuntime(): RuntimePortValue<ChannelPushRuntime>
  }
}

/** Package-owned registration map for Distribution deployment adapters. */
export function createDistributionRuntimePortContribution(
  host: DistributionRuntimeContributorHost,
): Readonly<Record<string, unknown>> {
  return {
    [channelPushRuntimePort.id]: host.capabilities.loadDistributionChannelPushRuntime(),
  }
}
