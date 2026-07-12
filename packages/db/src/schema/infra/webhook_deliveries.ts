import { index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { z } from "zod"

import { typeId, typeIdSchema } from "../../lib/index.js"

/**
 * Generic outbound HTTP delivery log.
 *
 * Every outbound HTTP call from any module writes a row per attempt for
 * observability, retry-chain history, and (eventually) durable
 * scheduling. Channel push is the first concrete consumer; future
 * consumers include operator-configured webhooks (delivering Voyant
 * events to operator-supplied URLs), third-party integrations (CRM
 * sync, accounting exports), and any other real-time outbound system
 * that needs the same observability surface.
 *
 * Distinct from `channel_webhook_events` (in distribution), which logs
 * events received FROM channels — opposite direction.
 *
 * Per docs/architecture/channel-push-architecture.md §11.
 *
 * IMPORTANT: callers MUST NOT INSERT directly. Use the
 * package-owned delivery helpers in `@voyant-travel/webhook-delivery` or the
 * Distribution channel-push envelope — they enforce auth-header redaction,
 * PII redaction, and excerpt-bounding. Direct inserts are a lint
 * violation per §11.3.
 */
export const infraWebhookDeliveriesTable = pgTable(
  "webhook_deliveries",
  {
    id: typeId("webhook_deliveries"),

    // ── Provenance: who issued this call and why ──────────────────────
    /** "distribution", "iam", "operator-webhooks", … */
    sourceModule: text("source_module").notNull(),
    /** "channel.booking.push", "channel.availability.push", … */
    sourceEvent: text("source_event").notNull(),
    /** e.g. "bookings", "products" — for entity-scoped queries. */
    sourceEntityModule: text("source_entity_module"),
    /** e.g. "book_xxx" — for entity-scoped queries. */
    sourceEntityId: text("source_entity_id"),
    /** References webhook_subscriptions.id when applicable. */
    subscriptionId: text("subscription_id"),

    // ── Target ────────────────────────────────────────────────────────
    targetUrl: text("target_url").notNull(),
    /** "channel:tui", "subscription", "internal", … */
    targetKind: text("target_kind"),
    /** e.g. channel_id when target_kind = "channel:*". */
    targetRef: text("target_ref"),

    // ── Request (sensitive headers redacted before write) ─────────────
    requestMethod: text("request_method").notNull(),
    /** Auth headers (Authorization, Cookie, X-Api-Key, …) MUST be redacted. */
    requestHeaders: jsonb("request_headers").$type<Record<string, string>>(),
    /** SHA-256 of the canonical request body — for idempotency / drift. */
    requestBodyHash: text("request_body_hash"),
    /** First N chars (bounded to 4 KB) for debugging. */
    requestBodyExcerpt: text("request_body_excerpt"),
    /** Complete schema-projected envelope required for restart-safe delivery. */
    requestPayload: jsonb("request_payload").$type<Record<string, unknown>>(),
    /** Selected event contract snapshot used for headers, audit, and replay checks. */
    deliveryContract: jsonb("delivery_contract").$type<Record<string, unknown>>(),

    // ── Response ──────────────────────────────────────────────────────
    responseStatus: integer("response_status"),
    responseHeaders: jsonb("response_headers").$type<Record<string, string>>(),
    responseBodyExcerpt: text("response_body_excerpt"),

    // ── Retry chain ──────────────────────────────────────────────────
    attemptNumber: integer("attempt_number").notNull().default(1),
    /** Previous attempt in the retry chain. */
    parentDeliveryId: text("parent_delivery_id"),
    /** Stable across retries; supplied by the caller. */
    idempotencyKey: text("idempotency_key"),

    // ── Lifecycle ────────────────────────────────────────────────────
    /** "pending" | "in_flight" | "succeeded" | "failed" | "abandoned" */
    status: text("status").notNull(),
    /** Package-owned workers claim rows when this timestamp is due. */
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),

    // ── Error detail ─────────────────────────────────────────────────
    /** "network" | "timeout" | "4xx" | "5xx" | "adapter_error" | "rate_limited" */
    errorClass: text("error_class"),
    errorMessage: text("error_message"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Claim-driven delivery worker index.
    index("idx_webhook_deliveries_pending").on(table.status, table.scheduledFor),
    // Module-scoped logs for the operator dashboard.
    index("idx_webhook_deliveries_module").on(table.sourceModule, table.createdAt),
    // Entity-scoped logs ("show me all deliveries for this booking").
    index("idx_webhook_deliveries_entity").on(
      table.sourceEntityModule,
      table.sourceEntityId,
      table.createdAt,
    ),
    // Retry-chain queries.
    index("idx_webhook_deliveries_idempotency").on(table.idempotencyKey, table.attemptNumber),
    // Per-subscription history.
    index("idx_webhook_deliveries_subscription").on(table.subscriptionId, table.createdAt),
    // Per-channel history (target_kind = "channel:*", target_ref = channel id).
    index("idx_webhook_deliveries_target").on(table.targetKind, table.targetRef, table.createdAt),
  ],
).enableRLS()

export type InsertInfraWebhookDelivery = typeof infraWebhookDeliveriesTable.$inferInsert
export type SelectInfraWebhookDelivery = typeof infraWebhookDeliveriesTable.$inferSelect

export const webhookDeliveryStatusSchema = z.enum([
  "pending",
  "in_flight",
  "succeeded",
  "failed",
  "abandoned",
])

export const webhookDeliveryErrorClassSchema = z.enum([
  "network",
  "timeout",
  "4xx",
  "5xx",
  "adapter_error",
  "rate_limited",
])

export const infraWebhookDeliverySelectSchema = z.object({
  id: typeIdSchema("webhook_deliveries"),
  sourceModule: z.string(),
  sourceEvent: z.string(),
  sourceEntityModule: z.string().nullable(),
  sourceEntityId: z.string().nullable(),
  subscriptionId: z.string().nullable(),
  targetUrl: z.string(),
  targetKind: z.string().nullable(),
  targetRef: z.string().nullable(),
  requestMethod: z.string(),
  requestHeaders: z.record(z.string(), z.string()).nullable(),
  requestBodyHash: z.string().nullable(),
  requestBodyExcerpt: z.string().nullable(),
  requestPayload: z.record(z.string(), z.unknown()).nullable(),
  deliveryContract: z.record(z.string(), z.unknown()).nullable(),
  responseStatus: z.number().int().nullable(),
  responseHeaders: z.record(z.string(), z.string()).nullable(),
  responseBodyExcerpt: z.string().nullable(),
  attemptNumber: z.number().int(),
  parentDeliveryId: z.string().nullable(),
  idempotencyKey: z.string().nullable(),
  status: webhookDeliveryStatusSchema,
  scheduledFor: z.date().nullable(),
  startedAt: z.date().nullable(),
  finishedAt: z.date().nullable(),
  durationMs: z.number().int().nullable(),
  errorClass: webhookDeliveryErrorClassSchema.nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type InfraWebhookDelivery = z.infer<typeof infraWebhookDeliverySelectSchema>
