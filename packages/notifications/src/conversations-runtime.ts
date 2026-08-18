import type {
  ConversationsChannelPolicy,
  ConversationsDeliveryTruthReader,
} from "@voyant-travel/conversations/runtime-port"
import type { ConversationsRenderedMessageAdmission } from "@voyant-travel/conversations-contracts"
import { inArray } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type { NotificationsRuntimeProvider } from "./runtime-port.js"
import { notificationDeliveries } from "./schema.js"
import { admitRenderedServiceMessage } from "./service-channel-accounts.js"
import {
  getOutboundSmsState,
  inspectInboundSmsAccount,
  projectInboundSmsPolicy,
} from "./service-sms-policy.js"
import type { RenderedServiceMessage } from "./types.js"

/**
 * Notifications-owned adapter for the Conversations consumer port.
 *
 * The supplied transaction is passed to Notifications' normal admission
 * service, so the Conversation Part and durable Notification delivery commit
 * or roll back together without Conversations reaching into Notification
 * tables.
 */
export function createConversationsRenderedMessageAdmission(
  runtime: NotificationsRuntimeProvider,
): ConversationsRenderedMessageAdmission {
  return {
    async admitRenderedServiceMessage(db, message, context) {
      const bindings = (context?.bindings ?? {}) as Record<string, unknown>
      const delivery = await admitRenderedServiceMessage(
        db as PostgresJsDatabase,
        runtime.resolveProviders(bindings),
        message satisfies RenderedServiceMessage,
      )
      return { deliveryId: delivery.id, state: delivery.status }
    },
  }
}

export function createConversationsChannelPolicy(): ConversationsChannelPolicy {
  return {
    inspectInboundSms(db, envelope) {
      return inspectInboundSmsAccount(db as PostgresJsDatabase, envelope)
    },
    projectInboundSmsPolicy(db, envelope) {
      return projectInboundSmsPolicy(db as PostgresJsDatabase, envelope)
    },
    getOutboundSmsState(db, input) {
      return getOutboundSmsState(db as PostgresJsDatabase, input)
    },
  }
}

export function createConversationsDeliveryTruthReader(): ConversationsDeliveryTruthReader {
  return {
    async getDeliveryTruth(db, deliveryIds) {
      if (deliveryIds.length === 0) return {}
      const rows = await (db as PostgresJsDatabase)
        .select({ id: notificationDeliveries.id, status: notificationDeliveries.status })
        .from(notificationDeliveries)
        .where(inArray(notificationDeliveries.id, [...new Set(deliveryIds)]))
      return Object.fromEntries(rows.map((row) => [row.id, row.status]))
    },
  }
}
