/**
 * Notifications agent tools on the framework tool contract. Read-only over the
 * existing notification-delivery service; the service is injected on the tool
 * context by intersection so this module stays deployment-agnostic.
 *
 * `send_notification` is exposed but deliberately **constrained**: an agent may
 * only trigger a **vetted template** (`templateSlug` required; raw subject/html/
 * text are rejected at the tool boundary), so it cannot compose arbitrary
 * content. It is gated on `notifications:send`, marked destructive +
 * `confirmationRequired`, and dispatches through the deployment's real provider
 * runtime. Sending is externally-committing (an email/SMS cannot be unsent) and
 * `notifications:send` is never granted by a wildcard — see the api-key taxonomy.
 */
import { defineTool, READ_ONLY_RISK, requireService, type ToolContext } from "@voyant-travel/tools"
import { listResponseSchema } from "@voyant-travel/types"
import { z } from "zod"

import { notificationDeliverySchema } from "./response-schemas.js"
import { notificationChannelSchema, notificationDeliveryListQuerySchema } from "./validation.js"

/** Template-only send payload — no arbitrary subject/html/text is accepted from an agent. */
export interface SendTemplatedNotificationInput {
  templateSlug: string
  to: string
  channel?: z.infer<typeof notificationChannelSchema>
  data?: Record<string, unknown>
  bookingId?: string
  invoiceId?: string
  personId?: string
  organizationId?: string
}

export interface NotificationsToolServices {
  listDeliveries(query: z.infer<typeof notificationDeliveryListQuerySchema>): Promise<unknown>
  getDeliveryById(id: string): Promise<unknown>
  sendTemplated(input: SendTemplatedNotificationInput): Promise<unknown>
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
  outputSchema: listResponseSchema(notificationDeliverySchema),
  requiredScopes: ["notifications:read"],
  tier: "read",
  riskPolicy: READ_ONLY_RISK,
  async handler(query, ctx) {
    return parseJsonResult(
      listResponseSchema(notificationDeliverySchema),
      await notifications(ctx).listDeliveries(query),
    )
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
  outputSchema: notificationDeliverySchema.nullable(),
  requiredScopes: ["notifications:read"],
  tier: "read",
  riskPolicy: READ_ONLY_RISK,
  async handler({ id }, ctx) {
    return parseJsonResult(
      notificationDeliverySchema.nullable(),
      await notifications(ctx).getDeliveryById(id),
    )
  },
})

const sendNotificationArgs = z.object({
  templateSlug: z
    .string()
    .min(1)
    .describe(
      "Slug of a vetted notification template to render. Required — agents may not send arbitrary content.",
    ),
  to: z.string().min(1).describe("Recipient address (email or phone, per the template channel)."),
  channel: notificationChannelSchema
    .optional()
    .describe("Override the template's default channel."),
  data: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Template variables merged into the rendered content."),
  bookingId: z.string().optional().describe("Associate the delivery with a booking."),
  invoiceId: z.string().optional().describe("Associate the delivery with an invoice."),
  personId: z.string().optional().describe("Associate the delivery with a CRM person."),
  organizationId: z.string().optional().describe("Associate the delivery with a CRM organization."),
})

export const sendNotificationTool = defineTool<
  z.infer<typeof sendNotificationArgs>,
  unknown,
  NotificationsToolContext
>({
  name: "send_notification",
  description:
    "Send a notification by rendering a vetted template to a recipient (externally-committing: an " +
    "email/SMS cannot be unsent). Only template sends are allowed — arbitrary subject/html/text is " +
    "not accepted. Requires the notifications:send grant and explicit confirmation.",
  inputSchema: sendNotificationArgs,
  outputSchema: notificationDeliverySchema,
  requiredScopes: ["notifications:send"],
  tier: "destructive",
  riskPolicy: {
    destructive: true,
    reversible: false,
    dryRunSupported: false,
    confirmationRequired: true,
    sideEffects: ["email", "sms"],
  },
  async handler(input, ctx) {
    return parseJsonResult(
      notificationDeliverySchema,
      await notifications(ctx).sendTemplated(input),
    )
  },
})

export const notificationsTools = [
  listDeliveriesTool,
  getDeliveryTool,
  sendNotificationTool,
] as const

function parseJsonResult<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  return schema.parse(toJsonValue(value))
}

function toJsonValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(toJsonValue)
  if (typeof value !== "object" || value === null) return value
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, nested]) => [key, toJsonValue(nested)] as const)
      .filter(([, nested]) => nested !== undefined),
  )
}
