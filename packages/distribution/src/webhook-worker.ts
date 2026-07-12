import type { AnyDrizzleDb } from "@voyant-travel/db"
import {
  type CreateWebhookDeliveryWorkerOptions,
  createWebhookDeliveryWorker,
  type WebhookDeliveryWorker,
} from "@voyant-travel/webhook-delivery"
import { createPostgresWebhookDeliveryStore } from "@voyant-travel/webhook-delivery/postgres"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

export function createDistributionWebhookDeliveryWorker(
  db: AnyDrizzleDb,
  options: Omit<CreateWebhookDeliveryWorkerOptions, "store"> = {},
): WebhookDeliveryWorker {
  return createWebhookDeliveryWorker({
    ...options,
    store: createPostgresWebhookDeliveryStore(db as PostgresJsDatabase),
  })
}
