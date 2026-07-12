import { defineToolContextContribution, requireService } from "@voyant-travel/tools"
import type { Context } from "hono"
import { notificationsRuntimePort } from "./runtime-port.js"
import { createNotificationService, notificationsService } from "./service.js"
import type { NotificationsToolServices } from "./tools.js"
import type { NotificationProvider } from "./types.js"

export * from "./tools.js"

export const voyantToolContextContribution = defineToolContextContribution({
  context: ["notifications"],
  async contribute({ request, resources }) {
    const c = request as Context
    const runtime = await Promise.resolve(
      requireService(
        resources[notificationsRuntimePort.id] as
          | {
              resolveProviders(bindings: Record<string, unknown>): readonly NotificationProvider[]
            }
          | undefined,
        notificationsRuntimePort.id,
      ),
    )
    const providers = runtime.resolveProviders(c.env as Record<string, unknown>)
    const notifications: NotificationsToolServices = {
      listDeliveries: (query) => notificationsService.listDeliveries(c.var.db, query),
      getDeliveryById: (id) => notificationsService.getDeliveryById(c.var.db, id),
      sendTemplated: (input) =>
        notificationsService.sendNotification(c.var.db, createNotificationService(providers), {
          ...input,
          targetType: "other",
        }),
    }
    return { notifications }
  },
})
