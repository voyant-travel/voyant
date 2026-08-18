import { conversationIngressSourcePort } from "@voyant-travel/conversations/runtime-port"
import { defineAdapter, providePort, requirePort } from "@voyant-travel/core/project"
import { notificationDeliveryLifecycleSourcePort } from "@voyant-travel/notifications/delivery-lifecycle-source-port"
import { durableNotificationProviderPort } from "@voyant-travel/notifications/durable-provider-port"
import { communicationsAdapterBundlePort } from "./runtime-port.js"

export const communicationsAdapterRuntime = defineAdapter({
  id: "@voyant-travel/communications-adapter-runtime",
  packageName: "@voyant-travel/communications-adapter-runtime",
  localId: "communications-adapter-runtime",
  runtimePorts: [requirePort(communicationsAdapterBundlePort)],
  provides: {
    ports: [
      providePort(durableNotificationProviderPort),
      providePort(conversationIngressSourcePort),
      providePort(notificationDeliveryLifecycleSourcePort),
    ],
  },
})
export default communicationsAdapterRuntime
