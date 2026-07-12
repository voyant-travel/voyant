import type { EventEnvelope } from "@voyant-travel/core"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import type { InfraWebhookDelivery } from "@voyant-travel/db/schema/infra"
import { infraWebhookSubscriptionsTable } from "@voyant-travel/db/schema/infra"
import {
  type ExternalWebhookEventContract,
  queueExternalWebhookEvent,
} from "@voyant-travel/webhook-delivery"
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
  const contract = selectedExternalContract(event)

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
  return queueExternalWebhookEvent({
    event,
    contract,
    sourceModule: stringMetadata(event, "graphEventSourceModule") ?? "graph-outbound-webhooks",
    subscriptions,
    enqueue: (attempt) =>
      enqueue(db, {
        ...attempt,
        targetKind: "subscription",
        targetRef: attempt.subscriptionId,
        requestMethod: "POST",
      }),
  })
}

function stringMetadata(event: EventEnvelope, key: string): string | null {
  const value = event.metadata?.[key]
  return typeof value === "string" && value.length > 0 ? value : null
}

function selectedExternalContract(event: EventEnvelope): ExternalWebhookEventContract {
  const eventId = stringMetadata(event, "graphEventId")
  const eventVersion = stringMetadata(event, "graphEventVersion")
  const payloadSchema = event.metadata?.graphEventPayloadSchema
  if (!eventId || !eventVersion || !isRecord(payloadSchema)) {
    throw new Error(
      `enqueueGraphWebhookEvent: event "${event.name}" is missing its selected external contract metadata`,
    )
  }
  return { eventId, eventType: event.name, eventVersion, payloadSchema }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
