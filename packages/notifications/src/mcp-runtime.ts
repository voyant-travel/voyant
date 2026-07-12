import { defineToolContextContribution, requireService } from "@voyant-travel/tools"
import type { Context } from "hono"
import {
  createNotificationService,
  notificationsService,
} from "./service.js"
import type { NotificationsToolServices } from "./tools.js"
import type { NotificationProvider } from "./types.js"

export * from "./tools.js"

export const voyantToolContextContribution = defineToolContextContribution({
  context: ["notifications"],
  contribute: ({ request, resources }) => {
    const c = request as Context
    const providers = requireService(
      resources.notifications as readonly NotificationProvider[] | undefined,
      "notifications MCP resource",
    )
    const notifications: NotificationsToolServices = {
      listDeliveries: (query) => notificationsService.listDeliveries(c.var.db, query),
      getDeliveryById: (id) => notificationsService.getDeliveryById(c.var.db, id),
      sendTemplated: (input) =>
        notificationsService.sendNotification(
          c.var.db,
          createNotificationService(providers),
          { ...input, targetType: "other" },
        ),
    }
    return { notifications }
  },
})
