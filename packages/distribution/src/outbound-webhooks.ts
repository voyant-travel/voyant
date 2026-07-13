import type { EventEnvelope } from "@voyant-travel/core"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import type {
  SelectedExternalWebhookQueue,
  WebhookEnqueueOutcome,
} from "@voyant-travel/webhook-delivery"
import { enqueuePostgresWebhookEvent } from "@voyant-travel/webhook-delivery/postgres"

export interface EnqueueGraphWebhookEventOptions {
  queue?: SelectedExternalWebhookQueue
}

/** Persist a complete projected delivery and return without performing HTTP. */
export async function enqueueGraphWebhookEvent(
  db: AnyDrizzleDb,
  event: EventEnvelope,
  options: EnqueueGraphWebhookEventOptions = {},
): Promise<WebhookEnqueueOutcome[]> {
  return enqueuePostgresWebhookEvent(db, event, options)
}
