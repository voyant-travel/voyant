import { sql } from "drizzle-orm"
import { boolean, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { z } from "zod"

import { typeId, typeIdSchema } from "../../lib/index.js"

/**
 * Organization webhook subscriptions
 *
 * Control-plane storage for outbound webhook delivery configuration.
 * Mirrors legacy comms.webhook_subscriptions managed by the dash app.
 */
export const infraWebhookSubscriptionsTable = pgTable(
  "webhook_subscriptions",
  {
    id: typeId("webhook_subscriptions"),
    url: text("url").notNull(),
    events: text("events").array().notNull().default(sql`ARRAY[]::text[]`),
    secret: text("secret").notNull(),
    active: boolean("active").notNull().default(true),
    maxRetries: integer("max_retries").notNull().default(5),
    headers: jsonb("headers").$type<Record<string, string>>(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    lastDeliveryAt: timestamp("last_delivery_at", { withTimezone: true }),
    failureCount: integer("failure_count").notNull().default(0),
  },
  (table) => [
    index("idx_infra_webhook_subs_active").on(table.active),
    index("idx_infra_webhook_subs_url").on(table.url),
  ],
).enableRLS()

export type InsertInfraWebhookSubscription = typeof infraWebhookSubscriptionsTable.$inferInsert
export type SelectInfraWebhookSubscription = typeof infraWebhookSubscriptionsTable.$inferSelect

const infraWebhookSubscriptionSharedSchema = {
  url: z.url({ message: "Webhook URL must be valid" }),
  events: z.array(z.string()).min(1, "At least one event is required"),
  secret: z.string().min(32, "Secret must be at least 32 characters"),
  active: z.boolean().default(true),
  maxRetries: z.number().int().min(0).max(10).default(5),
  headers: z.record(z.string(), z.string()).optional().nullable().default(null),
  description: z.string().optional().nullable(),
  lastDeliveryAt: z.date().nullable().optional(),
  failureCount: z.number().int().min(0).default(0),
}

export const infraWebhookSubscriptionInsertSchema = z
  .object({
    ...infraWebhookSubscriptionSharedSchema,
  })
  .omit({ lastDeliveryAt: true, failureCount: true })

export const infraWebhookSubscriptionUpdateSchema = z
  .object({
    ...infraWebhookSubscriptionSharedSchema,
  })
  .pick({
    url: true,
    events: true,
    secret: true,
    active: true,
    maxRetries: true,
    headers: true,
    description: true,
  })
  .partial()

export const infraWebhookSubscriptionSelectSchema = z.object({
  id: typeIdSchema("webhook_subscriptions"),
  ...infraWebhookSubscriptionSharedSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type InfraWebhookSubscription = z.infer<typeof infraWebhookSubscriptionSelectSchema>
export type NewInfraWebhookSubscription = z.infer<typeof infraWebhookSubscriptionInsertSchema>
export type UpdateInfraWebhookSubscription = z.infer<typeof infraWebhookSubscriptionUpdateSchema>
