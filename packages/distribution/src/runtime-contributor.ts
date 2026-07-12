import { type ChannelPushRuntime, channelPushRuntimePort } from "./channel-push/runtime-port.js"

type RuntimePortValue<T> = T | Promise<T>

export interface DistributionRuntimePortContribution {
  channelPush: RuntimePortValue<ChannelPushRuntime>
}

/** Package-owned registration map for Distribution deployment adapters. */
export function createDistributionRuntimePortContribution(
  contribution: DistributionRuntimePortContribution,
): Readonly<Record<string, unknown>> {
  return { [channelPushRuntimePort.id]: contribution.channelPush }
}
