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
  meta: {
    ownership: "package",
    agentTools: {
      posture: "not-applicable",
      rationale:
        "This adapter binds communications transport ports; agents act through Inbox and Notifications domain Tools rather than the transport directly.",
    },
  },
})
export default communicationsAdapterRuntime
