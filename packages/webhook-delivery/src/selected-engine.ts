import type { EventEnvelope } from "@voyant-travel/core"
import { isExternalWebhookPayloadSchema } from "@voyant-travel/core/project"

import { type ExternalWebhookEventContract, prepareExternalWebhookEvent } from "./contracts.js"
import { createWebhookDeliveryEngine } from "./engine.js"
import type {
  CreateWebhookDeliveryEngineOptions,
  WebhookDeliveryEngine,
  WebhookVisibilityPolicy,
} from "./types.js"

export interface CreateSelectedExternalWebhookDeliveryEngineOptions
  extends Omit<CreateWebhookDeliveryEngineOptions, "visibilityPolicy"> {
  contracts: readonly ExternalWebhookEventContract[]
}

export function createSelectedExternalWebhookDeliveryEngine(
  options: CreateSelectedExternalWebhookDeliveryEngineOptions,
): WebhookDeliveryEngine {
  const { contracts, ...engineOptions } = options
  return createWebhookDeliveryEngine({
    ...engineOptions,
    visibilityPolicy: selectedExternalVisibilityPolicy(contracts),
  })
}

function selectedExternalVisibilityPolicy(
  contracts: readonly ExternalWebhookEventContract[],
): WebhookVisibilityPolicy {
  const byEventType = new Map<string, ExternalWebhookEventContract>()
  for (const contract of contracts) {
    if (byEventType.has(contract.eventType)) {
      throw new Error(`Duplicate external webhook event contract "${contract.eventType}".`)
    }
    byEventType.set(contract.eventType, contract)
  }

  return {
    authorize({ event }) {
      const contract = byEventType.get(event.name)
      if (!contract) {
        return { allowed: false, reason: "event is not in the selected external catalog" }
      }
      return { allowed: true, payload: prepareExternalWebhookEvent(event, contract) }
    },
  }
}

export function externalContractFromEventMetadata(
  event: EventEnvelope,
): ExternalWebhookEventContract {
  const eventId = stringMetadata(event, "graphEventId")
  const eventVersion = stringMetadata(event, "graphEventVersion")
  const payloadSchema = event.metadata?.graphEventPayloadSchema
  if (!eventId || !eventVersion || !isExternalWebhookPayloadSchema(payloadSchema)) {
    throw new Error(
      `External webhook event "${event.name}" is missing its selected contract metadata.`,
    )
  }
  return { eventId, eventType: event.name, eventVersion, payloadSchema }
}

function stringMetadata(event: EventEnvelope, key: string): string | null {
  const value = event.metadata?.[key]
  return typeof value === "string" && value.length > 0 ? value : null
}
