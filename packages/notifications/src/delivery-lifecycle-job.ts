import {
  canonicalSchemaPayload,
  deliveryLifecycleEventSchema,
} from "@voyant-travel/channel-adapter-contracts"
import type { VoyantGraphRuntimeFactoryContext } from "@voyant-travel/core/project"
import { and, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import {
  type NotificationDeliveryLifecycleSource,
  notificationDeliveryLifecycleSourcePort,
} from "./delivery-lifecycle-source-port.js"
import { notificationsRuntimePort } from "./runtime-port.js"
import { notificationChannelAccounts, notificationDeliveries } from "./schema.js"
import { reconcileNotificationDeliveryEvent } from "./service-channel-accounts.js"

export async function processNotificationDeliveryLifecycle(input: {
  db: PostgresJsDatabase
  sources: readonly NotificationDeliveryLifecycleSource[]
  limit?: number
}) {
  const summary = { fetched: 0, committed: 0, duplicates: 0, acknowledged: 0 }
  for (const source of input.sources) {
    const page = await source.list({ limit: Math.min(input.limit ?? 50, 100) })
    for (const ref of page.items) {
      const raw = await source.fetch(ref)
      const event = deliveryLifecycleEventSchema.parse(raw)
      if (event.adapterAccountRef !== ref.adapterAccountRef)
        throw new Error("Lifecycle event account scope mismatch")
      const [delivery] = await input.db
        .select({
          id: notificationDeliveries.id,
          adapterRef: notificationChannelAccounts.adapterRef,
        })
        .from(notificationDeliveries)
        .innerJoin(
          notificationChannelAccounts,
          eq(notificationDeliveries.channelAccountId, notificationChannelAccounts.id),
        )
        .where(
          and(
            eq(notificationDeliveries.providerMessageId, event.externalSubmissionId),
            eq(notificationChannelAccounts.adapterRef, event.adapterAccountRef),
          ),
        )
        .limit(1)
      if (!delivery) throw new Error("Lifecycle event does not match a durable delivery")
      const result = await reconcileNotificationDeliveryEvent(input.db, {
        adapterRef: delivery.adapterRef,
        adapterEventId: event.externalEventId,
        deliveryId: delivery.id,
        status: event.state,
        occurredAt: new Date(event.occurredAt),
        details: {
          reasonCode: event.reasonCode,
          canonicalPayload: canonicalSchemaPayload(deliveryLifecycleEventSchema, event),
        },
      })
      summary.fetched += 1
      if (result.created) summary.committed += 1
      else summary.duplicates += 1
      // The ledger transaction committed before this acknowledgement.
      await source.ack(ref)
      summary.acknowledged += 1
    }
  }
  return summary
}

export async function runNotificationDeliveryLifecycleJob(
  context: VoyantGraphRuntimeFactoryContext,
): Promise<void> {
  const runtime = await context.getPort(notificationsRuntimePort)
  await processNotificationDeliveryLifecycle({
    db: runtime.resolveDb() as PostgresJsDatabase,
    sources: await context.getPorts(notificationDeliveryLifecycleSourcePort),
  })
}
