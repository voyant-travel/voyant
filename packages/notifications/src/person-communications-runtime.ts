import type {
  PersonNotificationDelivery,
  PersonNotificationDeliveryQuery,
  RelationshipsPersonNotificationsRuntime,
} from "@voyant-travel/relationships/runtime-port"
import { and, desc, eq, gte, inArray, lt, lte, or } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { notificationDeliveries } from "./schema.js"

/**
 * Expose delivered customer messages to the CRM Communications tab.
 *
 * Delivery status stays authoritative here. The timeline includes unsuccessful
 * attempts too, explicitly labelled with their current lifecycle truth.
 */
export function createPersonCommunicationsRuntime(): RelationshipsPersonNotificationsRuntime {
  return {
    async listPersonDeliveries(
      db: unknown,
      personId: string,
      query: PersonNotificationDeliveryQuery,
    ): Promise<readonly PersonNotificationDelivery[]> {
      const database = db as PostgresJsDatabase
      const conditions = [
        eq(notificationDeliveries.personId, personId),
        inArray(notificationDeliveries.channel, ["email", "sms"]),
      ]
      if (!query.includeAllStatuses) {
        conditions.push(eq(notificationDeliveries.status, "delivered"))
      }
      if (query.channel === "email" || query.channel === "sms") {
        conditions.push(eq(notificationDeliveries.channel, query.channel))
      }
      if (query.dateFrom) {
        conditions.push(gte(notificationDeliveries.createdAt, new Date(query.dateFrom)))
      }
      if (query.dateTo) {
        conditions.push(lte(notificationDeliveries.createdAt, new Date(query.dateTo)))
      }
      if (query.boundary) {
        const at = new Date(query.boundary.occurredAt)
        // Notifications sort after the other two sources at an equal instant.
        conditions.push(
          query.boundary.source === "notification"
            ? or(
                lt(notificationDeliveries.createdAt, at),
                and(
                  eq(notificationDeliveries.createdAt, at),
                  lt(notificationDeliveries.id, query.boundary.id),
                ),
              )!
            : lte(notificationDeliveries.createdAt, at),
        )
      }

      const rows = await database
        .select({
          id: notificationDeliveries.id,
          channel: notificationDeliveries.channel,
          subject: notificationDeliveries.subject,
          textBody: notificationDeliveries.textBody,
          status: notificationDeliveries.status,
          deliveredAt: notificationDeliveries.deliveredAt,
          createdAt: notificationDeliveries.createdAt,
        })
        .from(notificationDeliveries)
        .where(and(...conditions))
        .orderBy(desc(notificationDeliveries.createdAt))
        .limit(query.limit)

      return rows.map((row) => ({
        id: row.id,
        channel: row.channel === "sms" ? "sms" : "email",
        subject: row.subject ?? null,
        body: row.textBody ?? null,
        status: row.status,
        occurredAt: (!query.includeAllStatuses && row.deliveredAt
          ? row.deliveredAt
          : row.createdAt
        ).toISOString(),
        createdAt: row.createdAt.toISOString(),
      }))
    },
    async getDeliveryTruth(db, deliveryIds) {
      if (deliveryIds.length === 0) return {}
      const rows = await (db as PostgresJsDatabase)
        .select({ id: notificationDeliveries.id, status: notificationDeliveries.status })
        .from(notificationDeliveries)
        .where(inArray(notificationDeliveries.id, [...deliveryIds]))
      return Object.fromEntries(rows.map((row) => [row.id, row.status]))
    },
  }
}
