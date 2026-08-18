import { conversationIngressSourcePort } from "@voyant-travel/conversations/runtime-port"
import type { VoyantPort } from "@voyant-travel/core/project"
import { notificationDeliveryLifecycleSourcePort } from "@voyant-travel/notifications/delivery-lifecycle-source-port"
import { durableNotificationProviderPort } from "@voyant-travel/notifications/durable-provider-port"
import { createCommunicationsAdapterBridge } from "./bridge.js"
import {
  type CommunicationsAdapterBundle,
  communicationsAdapterBundlePort,
} from "./runtime-port.js"

export function createCommunicationsAdapterRuntimePortContribution(host: {
  getRuntimePort<T>(port: Pick<VoyantPort<T>, "id">): T | Promise<T>
}): Readonly<Record<string, unknown>> {
  const bridge = Promise.resolve(
    host.getRuntimePort<CommunicationsAdapterBundle>(communicationsAdapterBundlePort),
  ).then(createCommunicationsAdapterBridge)
  return {
    [durableNotificationProviderPort.id]: bridge.then(({ durableRuntime }) => durableRuntime),
    [conversationIngressSourcePort.id]: bridge.then(({ ingressSource }) => ingressSource),
    [notificationDeliveryLifecycleSourcePort.id]: bridge.then(
      ({ lifecycleSource }) => lifecycleSource,
    ),
  }
}
