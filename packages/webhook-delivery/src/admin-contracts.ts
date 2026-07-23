import { z } from "zod"

const MAX_EVENTS = 64

const eventNameSchema = z.string().trim().min(1).max(120)
const dateValueSchema = z.union([z.string(), z.date()])

export const webhookSubscriptionCreateSchema = z
  .object({
    url: z.url().max(2_048),
    events: z
      .array(eventNameSchema)
      .min(1)
      .max(MAX_EVENTS)
      .refine((events) => new Set(events).size === events.length, "Events must be unique."),
    active: z.boolean().optional().default(true),
    maxRetries: z.number().int().min(0).max(10).optional().default(5),
    description: z.string().trim().max(500).nullable().optional().default(null),
  })
  .strict()

export const webhookSubscriptionUpdateSchema = webhookSubscriptionCreateSchema
  .omit({ active: true })
  .partial()
  .refine((input) => Object.keys(input).length > 0, "At least one field is required.")

export const webhookSubscriptionTestSchema = z
  .object({
    event: eventNameSchema.optional(),
  })
  .strict()

export const webhookDeliveryListQuerySchema = z
  .object({
    subscriptionId: z.string().trim().min(1).max(128).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  })
  .strict()

export type WebhookSubscriptionCreateInput = z.infer<typeof webhookSubscriptionCreateSchema>
export type WebhookSubscriptionUpdateInput = z.infer<typeof webhookSubscriptionUpdateSchema>
export type WebhookSubscriptionTestInput = z.infer<typeof webhookSubscriptionTestSchema>
export type WebhookDeliveryListQuery = z.infer<typeof webhookDeliveryListQuerySchema>

export const operatorWebhookEventSchema = z.object({
  id: z.string(),
  eventType: z.string(),
  version: z.string(),
  payloadSchema: z.record(z.string(), z.unknown()),
})

export const operatorWebhookSubscriptionSchema = z.object({
  id: z.string(),
  url: z.string(),
  events: z.array(z.string()),
  active: z.boolean(),
  maxRetries: z.number().int(),
  description: z.string().nullable(),
  createdAt: dateValueSchema,
  updatedAt: dateValueSchema,
  lastDeliveryAt: dateValueSchema.nullable(),
  failureCount: z.number().int(),
})

export const operatorWebhookDeliverySchema = z.object({
  id: z.string(),
  subscriptionId: z.string().nullable(),
  sourceEvent: z.string(),
  targetUrl: z.string(),
  status: z.enum(["pending", "in_flight", "succeeded", "failed", "abandoned"]),
  attemptNumber: z.number().int(),
  responseStatus: z.number().int().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: dateValueSchema,
  finishedAt: dateValueSchema.nullable(),
})

export const operatorWebhookOneTimeSecretSchema = z.object({
  subscription: operatorWebhookSubscriptionSchema,
  secret: z.string(),
})
