import { conversationIngressSourcePort } from "@voyant-travel/conversations/runtime-port"
import { defineAdapter, providePort, requirePort } from "@voyant-travel/core/project"
import {
  durableNotificationProviderPort,
  notificationDeliveryLifecycleSourcePort,
} from "@voyant-travel/notifications/ports"
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
