/**
 * Notifications agent tools on the framework tool contract. Read-only over the
 * existing notification-delivery service; the service is injected on the tool
 * context by intersection so this module stays deployment-agnostic.
 *
 * NOTE: a `send_notification` tool is deliberately **not** exposed here. Sending
 * customer-facing email/SMS is a known abuse vector (SMS/email bomb) and requires
 * the full provider runtime plus rate limiting; it will land as a separate,
 * carefully-gated increment (`notifications:send`).
 */
import { defineTool, READ_ONLY_RISK, requireService, type ToolContext } from "@voyant-travel/tools"
import { z } from "zod"

import { notificationDeliveryListQuerySchema } from "./validation.js"

export interface NotificationsToolServices {
  listDeliveries(query: z.infer<typeof notificationDeliveryListQuerySchema>): Promise<unknown>
  getDeliveryById(id: string): Promise<unknown>
}

export type NotificationsToolContext = ToolContext & { notifications?: NotificationsToolServices }

function notifications(ctx: NotificationsToolContext): NotificationsToolServices {
  return requireService(ctx.notifications, "notifications")
}

export const listDeliveriesTool = defineTool<
  z.infer<typeof notificationDeliveryListQuerySchema>,
  unknown,
  NotificationsToolContext
>({
  name: "list_notification_deliveries",
  description: "List notification deliveries with filters and pagination. Read-only.",
  inputSchema: notificationDeliveryListQuerySchema,
  outputSchema: z.custom<unknown>(),
  requiredScopes: ["notifications:read"],
  tier: "read",
  riskPolicy: READ_ONLY_RISK,
  async handler(query, ctx) {
    return notifications(ctx).listDeliveries(query)
  },
})

const getDeliveryArgs = z.object({
  id: z.string().min(1).describe("The notification delivery id."),
})

export const getDeliveryTool = defineTool<
  z.infer<typeof getDeliveryArgs>,
  unknown,
  NotificationsToolContext
>({
  name: "get_notification_delivery",
  description: "Read a single notification delivery by id. Read-only.",
  inputSchema: getDeliveryArgs,
  outputSchema: z.custom<unknown>(),
  requiredScopes: ["notifications:read"],
  tier: "read",
  riskPolicy: READ_ONLY_RISK,
  async handler({ id }, ctx) {
    return notifications(ctx).getDeliveryById(id)
  },
})

export const notificationsTools = [listDeliveriesTool, getDeliveryTool] as const
