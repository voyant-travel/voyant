import type { ConversationsRenderedMessageAdmission } from "@voyant-travel/conversations-contracts"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type { NotificationsRuntimeProvider } from "./runtime-port.js"
import { admitRenderedServiceMessage } from "./service-channel-accounts.js"
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
