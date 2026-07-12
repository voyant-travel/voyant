import type { EventEnvelope } from "@voyant-travel/core"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import {
  createSelectedExternalWebhookDeliveryEngine,
  externalContractFromEventMetadata,
  type WebhookDeliveryAuditEvent,
  type WebhookDeliveryEngine,
  type WebhookDeliveryOutcome,
  type WebhookRetryOptions,
} from "@voyant-travel/webhook-delivery"
import { createPostgresWebhookDeliveryStore } from "@voyant-travel/webhook-delivery/postgres"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

export interface EnqueueGraphWebhookEventOptions {
  engine?: WebhookDeliveryEngine
  fetch?: typeof globalThis.fetch
  retry?: WebhookRetryOptions
  onAudit?: (event: WebhookDeliveryAuditEvent) => void | Promise<void>
}

/**
 * Execute a graph-approved event through the package-owned delivery engine.
 * Signing, retries, audit callbacks, and dead-letter state have one owner.
 */
export async function enqueueGraphWebhookEvent(
  db: AnyDrizzleDb,
  event: EventEnvelope,
  options: EnqueueGraphWebhookEventOptions = {},
): Promise<WebhookDeliveryOutcome[]> {
  const contract = externalContractFromEventMetadata(event)
  const engine =
    options.engine ??
    createSelectedExternalWebhookDeliveryEngine({
      contracts: [contract],
      store: createPostgresWebhookDeliveryStore(db as PostgresJsDatabase),
      ...(options.fetch ? { fetch: options.fetch } : {}),
      ...(options.retry ? { retry: options.retry } : {}),
      ...(options.onAudit ? { onAudit: options.onAudit } : {}),
    })
  return engine.enqueue(event)
}
