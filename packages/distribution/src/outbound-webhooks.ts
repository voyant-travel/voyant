import type { EventEnvelope } from "@voyant-travel/core"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import {
  createSelectedExternalWebhookQueue,
  externalContractFromEventMetadata,
  type SelectedExternalWebhookQueue,
  type WebhookEnqueueOutcome,
} from "@voyant-travel/webhook-delivery"
import { createPostgresWebhookDeliveryStore } from "@voyant-travel/webhook-delivery/postgres"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

export interface EnqueueGraphWebhookEventOptions {
  queue?: SelectedExternalWebhookQueue
}

/** Persist a complete projected delivery and return without performing HTTP. */
export async function enqueueGraphWebhookEvent(
  db: AnyDrizzleDb,
  event: EventEnvelope,
  options: EnqueueGraphWebhookEventOptions = {},
): Promise<WebhookEnqueueOutcome[]> {
  const contract = externalContractFromEventMetadata(event)
  const queue =
    options.queue ??
    createSelectedExternalWebhookQueue({
      contracts: [contract],
      store: createPostgresWebhookDeliveryStore(db as PostgresJsDatabase),
    })
  return queue.enqueue(event)
}
