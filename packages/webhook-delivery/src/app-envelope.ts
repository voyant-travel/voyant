import type { EventEnvelope } from "@voyant-travel/core"

import type { ExternalWebhookEventContract } from "./contracts.js"

export interface AppWebhookDeliveryEnvelope {
  schema: "voyant.app-webhook.delivery.v1"
  deliveryId: string
  installationId: string
  appId: string
  event: {
    type: string
    schemaVersion: string
    occurredAt: string
    deliveredAt: string
  }
  attempt: {
    number: number
    maxRetries: number
    idempotencyKey: string
    originalDeliveryId: string | null
    parentDeliveryId: string | null
  }
  subject: {
    module: string | null
    id: string | null
  }
  payload: unknown
  metadata: Record<string, unknown>
}

export function createAppWebhookDeliveryEnvelope(input: {
  deliveryId: string
  installationId: string
  appId: string
  event: EventEnvelope
  contract: ExternalWebhookEventContract
  deliveredAt: Date
  attemptNumber: number
  maxRetries: number
  idempotencyKey: string
  originalDeliveryId?: string | null
  parentDeliveryId?: string | null
}): AppWebhookDeliveryEnvelope {
  const subject = sourceEntity(input.event.data)
  return {
    schema: "voyant.app-webhook.delivery.v1",
    deliveryId: input.deliveryId,
    installationId: input.installationId,
    appId: input.appId,
    event: {
      type: input.event.name,
      schemaVersion: input.contract.eventVersion,
      occurredAt: input.event.emittedAt,
      deliveredAt: input.deliveredAt.toISOString(),
    },
    attempt: {
      number: input.attemptNumber,
      maxRetries: input.maxRetries,
      idempotencyKey: input.idempotencyKey,
      originalDeliveryId: input.originalDeliveryId ?? null,
      parentDeliveryId: input.parentDeliveryId ?? null,
    },
    subject,
    payload: input.event.data,
    metadata: input.event.metadata ?? {},
  }
}

export function isAppWebhookDeliveryEnvelope(value: unknown): value is AppWebhookDeliveryEnvelope {
  return (
    isRecord(value) &&
    value.schema === "voyant.app-webhook.delivery.v1" &&
    typeof value.deliveryId === "string" &&
    typeof value.installationId === "string" &&
    typeof value.appId === "string" &&
    isRecord(value.event) &&
    typeof value.event.type === "string" &&
    typeof value.event.schemaVersion === "string" &&
    typeof value.event.occurredAt === "string" &&
    typeof value.event.deliveredAt === "string" &&
    isRecord(value.attempt) &&
    typeof value.attempt.number === "number" &&
    typeof value.attempt.idempotencyKey === "string" &&
    "payload" in value
  )
}

function sourceEntity(data: unknown): { module: string | null; id: string | null } {
  if (!isRecord(data)) return { module: null, id: null }
  const module = data.entityModule ?? data.entity_module
  const id = data.entityId ?? data.entity_id
  return {
    module: typeof module === "string" ? module : null,
    id: typeof id === "string" ? id : null,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
