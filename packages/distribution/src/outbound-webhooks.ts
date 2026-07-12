import type { EventEnvelope } from "@voyant-travel/core"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import type { InfraWebhookDelivery } from "@voyant-travel/db/schema/infra"
import { infraWebhookSubscriptionsTable } from "@voyant-travel/db/schema/infra"
import { and, arrayContains, eq } from "drizzle-orm"

import { enqueueOutboundEnvelope } from "./webhook-deliveries.js"

export interface EnqueueGraphWebhookEventOptions {
  enqueue?: typeof enqueueOutboundEnvelope
}

/**
 * Fan a graph-approved event out to enabled subscriptions as durable pending
 * delivery records. HTTP dispatch and retry are intentionally worker-owned.
 */
export async function enqueueGraphWebhookEvent(
  db: AnyDrizzleDb,
  event: EventEnvelope,
  options: EnqueueGraphWebhookEventOptions = {},
): Promise<InfraWebhookDelivery[]> {
  const eventId = event.metadata?.eventId
  if (typeof eventId !== "string" || eventId.length === 0) {
    throw new Error(`enqueueGraphWebhookEvent: event "${event.name}" has no metadata.eventId`)
  }

  const subscriptions = await db
    .select()
    .from(infraWebhookSubscriptionsTable)
    .where(
      and(
        eq(infraWebhookSubscriptionsTable.active, true),
        arrayContains(infraWebhookSubscriptionsTable.events, [event.name]),
      ),
    )

  const enqueue = options.enqueue ?? enqueueOutboundEnvelope
  return Promise.all(
    subscriptions.map((subscription) => {
      const idempotencyKey = `graph-webhook:${eventId}:${subscription.id}`
      const graphEventId = stringMetadata(event, "graphEventId")
      const graphEventVersion = stringMetadata(event, "graphEventVersion")
      const sourceModule = stringMetadata(event, "graphEventSourceModule")
      return enqueue(db, {
        sourceModule: sourceModule ?? "operator-webhooks",
        sourceEvent: event.name,
        ...sourceEntity(event.data),
        subscriptionId: subscription.id,
        targetUrl: subscription.url,
        targetKind: "subscription",
        targetRef: subscription.id,
        requestMethod: "POST",
        requestHeaders: {
          ...(subscription.headers ?? {}),
          "content-type": "application/json",
          "idempotency-key": idempotencyKey,
          "x-voyant-event": event.name,
          ...(graphEventId ? { "x-voyant-event-contract": graphEventId } : {}),
          ...(graphEventVersion ? { "x-voyant-event-version": graphEventVersion } : {}),
        },
        requestBody: event,
        idempotencyKey,
      })
    }),
  )
}

function stringMetadata(event: EventEnvelope, key: string): string | null {
  const value = event.metadata?.[key]
  return typeof value === "string" && value.length > 0 ? value : null
}

function sourceEntity(data: unknown): {
  sourceEntityModule?: string
  sourceEntityId?: string
} {
  if (data === null || typeof data !== "object" || Array.isArray(data)) return {}
  const record = data as Record<string, unknown>
  const module = record.entityModule ?? record.entity_module
  const id = record.entityId ?? record.entity_id
  return {
    ...(typeof module === "string" ? { sourceEntityModule: module } : {}),
    ...(typeof id === "string" ? { sourceEntityId: id } : {}),
  }
}
