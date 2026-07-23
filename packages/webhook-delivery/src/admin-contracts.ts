import { z } from "zod"

import { assertSafeWebhookCustomHeaders } from "./security.js"

const MAX_EVENTS = 64
const MAX_CUSTOM_HEADERS = 16

const eventNameSchema = z.string().trim().min(1).max(120)
const headerNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/, "Invalid HTTP header name.")
const headerValueSchema = z
  .string()
  .max(512)
  .refine((value) => !/[\r\n]/.test(value), "HTTP header values must not contain newlines.")
const customHeadersSchema = z
  .record(headerNameSchema, headerValueSchema)
  .superRefine((headers, context) => {
    if (Object.keys(headers).length > MAX_CUSTOM_HEADERS) {
      context.addIssue({
        code: "custom",
        message: `At most ${MAX_CUSTOM_HEADERS} custom headers are allowed.`,
      })
    }
    try {
      assertSafeWebhookCustomHeaders(headers)
    } catch {
      context.addIssue({
        code: "custom",
        message: "Custom headers must not include credentials or Voyant-reserved headers.",
      })
    }
  })

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
    headers: customHeadersSchema.nullable().optional().default(null),
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
