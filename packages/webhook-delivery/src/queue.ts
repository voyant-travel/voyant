import type { EventEnvelope } from "@voyant-travel/core"

import { type ExternalWebhookEventContract, prepareExternalWebhookEvent } from "./contracts.js"

export interface QueuedWebhookSubscription {
  id: string
  url: string
  headers?: Record<string, string> | null
}

export interface QueueExternalWebhookAttemptInput {
  sourceModule: string
  sourceEvent: string
  sourceEntityModule?: string
  sourceEntityId?: string
  subscriptionId: string
  targetUrl: string
  requestHeaders: Record<string, string>
  requestBody: EventEnvelope
  idempotencyKey: string
}

export async function queueExternalWebhookEvent<TResult>(input: {
  event: EventEnvelope
  contract: ExternalWebhookEventContract
  sourceModule: string
  subscriptions: readonly QueuedWebhookSubscription[]
  enqueue: (attempt: QueueExternalWebhookAttemptInput) => Promise<TResult>
}): Promise<TResult[]> {
  const eventId = input.event.metadata?.eventId
  if (typeof eventId !== "string" || eventId.trim().length === 0) {
    throw new Error(`External webhook event "${input.event.name}" requires metadata.eventId.`)
  }
  const event = prepareExternalWebhookEvent(input.event, input.contract)
  const entity = sourceEntity(event.data)

  return Promise.all(
    input.subscriptions.map((subscription) => {
      const idempotencyKey = `graph-webhook:${eventId}:${subscription.id}`
      return input.enqueue({
        sourceModule: input.sourceModule,
        sourceEvent: event.name,
        ...entity,
        subscriptionId: subscription.id,
        targetUrl: subscription.url,
        requestHeaders: {
          ...(subscription.headers ?? {}),
          "content-type": "application/json",
          "idempotency-key": idempotencyKey,
          "x-voyant-event": event.name,
          "x-voyant-event-contract": input.contract.eventId,
          "x-voyant-event-version": input.contract.eventVersion,
        },
        requestBody: event,
        idempotencyKey,
      })
    }),
  )
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
