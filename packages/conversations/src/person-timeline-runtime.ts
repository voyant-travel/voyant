import type {
  PersonConversationPart,
  RelationshipsPersonConversationsRuntime,
} from "@voyant-travel/relationships/runtime-port"
import { and, desc, eq, gte, inArray, isNotNull, lt, lte, ne, or } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { conversationInboxMemberships, conversationParts, conversations } from "./schema.js"

const sourceRank = { logged: 0, conversation: 1, notification: 2 } as const

export function createPersonTimelineRuntime(): RelationshipsPersonConversationsRuntime {
  return {
    async listPersonParts(db, personId, query): Promise<readonly PersonConversationPart[]> {
      const database = db as PostgresJsDatabase
      const conditions = [
        eq(conversations.personRef, personId),
        inArray(conversations.channel, ["email", "sms"]),
        eq(conversationInboxMemberships.userId, query.actorUserId),
        eq(conversationInboxMemberships.active, true),
        eq(conversationParts.classification, "message"),
        ne(conversationParts.contentStatus, "quarantined"),
      ]
      if (query.channel) conditions.push(eq(conversations.channel, query.channel))
      if (query.direction) conditions.push(eq(conversationParts.direction, query.direction))
      if (query.dateFrom)
        conditions.push(gte(conversationParts.occurredAt, new Date(query.dateFrom)))
      if (query.dateTo) conditions.push(lte(conversationParts.occurredAt, new Date(query.dateTo)))
      if (query.boundary) {
        const at = new Date(query.boundary.occurredAt)
        const rank = sourceRank.conversation
        conditions.push(
          rank > sourceRank[query.boundary.source]
            ? lte(conversationParts.occurredAt, at)
            : rank < sourceRank[query.boundary.source]
              ? lt(conversationParts.occurredAt, at)
              : or(
                  lt(conversationParts.occurredAt, at),
                  and(
                    eq(conversationParts.occurredAt, at),
                    lt(conversationParts.id, query.boundary.id),
                  ),
                )!,
        )
      }
      const rows = await database
        .select({
          id: conversationParts.id,
          conversationId: conversationParts.conversationId,
          channel: conversations.channel,
          direction: conversationParts.direction,
          subject: conversationParts.subject,
          body: conversationParts.textBody,
          contentStatus: conversationParts.contentStatus,
          classification: conversationParts.classification,
          notificationDeliveryId: conversationParts.notificationDeliveryId,
          occurredAt: conversationParts.occurredAt,
          createdAt: conversationParts.createdAt,
        })
        .from(conversationParts)
        .innerJoin(conversations, eq(conversations.id, conversationParts.conversationId))
        .innerJoin(
          conversationInboxMemberships,
          eq(conversationInboxMemberships.inboxId, conversations.inboxId),
        )
        .where(and(...conditions))
        .orderBy(desc(conversationParts.occurredAt), desc(conversationParts.id))
        .limit(query.limit)
      return rows.map((row) => ({
        ...row,
        subject: row.contentStatus === "safe" ? row.subject : null,
        body: row.contentStatus === "safe" ? row.body : null,
        deliveryStatus: null,
        channel: row.channel as "email" | "sms",
        occurredAt: row.occurredAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
      }))
    },

    async findLinkedDeliveryIds(
      db,
      personId,
      deliveryIds,
      actorUserId,
    ): Promise<readonly string[]> {
      if (deliveryIds.length === 0) return []
      const database = db as PostgresJsDatabase
      const rows = await database
        .select({ id: conversationParts.notificationDeliveryId })
        .from(conversationParts)
        .innerJoin(conversations, eq(conversations.id, conversationParts.conversationId))
        .innerJoin(
          conversationInboxMemberships,
          eq(conversationInboxMemberships.inboxId, conversations.inboxId),
        )
        .where(
          and(
            eq(conversations.personRef, personId),
            eq(conversationInboxMemberships.userId, actorUserId),
            eq(conversationInboxMemberships.active, true),
            isNotNull(conversationParts.notificationDeliveryId),
            inArray(conversationParts.notificationDeliveryId, [...deliveryIds]),
          ),
        )
      return rows.flatMap((row) => (row.id ? [row.id] : []))
    },

    async mergePersonHistory(db, survivorPersonId, mergedPersonId) {
      await (db as PostgresJsDatabase)
        .update(conversations)
        .set({ personRef: survivorPersonId, updatedAt: new Date() })
        .where(eq(conversations.personRef, mergedPersonId))
    },
  }
}
