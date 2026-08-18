import type { StaffDirectoryRuntimeProvider } from "@voyant-travel/auth/staff-directory-runtime-port"
import type {
  ConversationIngressSource,
  ConversationsRenderedMessageAdmission,
} from "@voyant-travel/conversations-contracts"
import { definePort } from "@voyant-travel/core/project"
import type { AnyDrizzleDb } from "@voyant-travel/db"

export interface ConversationsDatabaseRuntime {
  resolveDb(bindings?: unknown): AnyDrizzleDb
}

export type {
  ConversationMessageAdmissionResult,
  ConversationRenderedServiceMessage,
  ConversationsRenderedMessageAdmission,
} from "@voyant-travel/conversations-contracts"

export type PersonEmailResolution =
  | { kind: "none" }
  | { kind: "ambiguous" }
  | { kind: "unique"; personRef: string; contactPointRef: string; address: string }

/** Read-only People boundary. It deliberately has no create or merge operation. */
export interface ConversationsPersonDirectory {
  resolveEmail(db: unknown, address: string): Promise<PersonEmailResolution>
  resolvePersonContactPoint(
    db: unknown,
    input: { personRef: string; contactPointRef: string },
  ): Promise<{ address: string } | null>
}

export type ConversationsStaffDirectory = StaffDirectoryRuntimeProvider

export const conversationsDatabaseRuntimePort = definePort<ConversationsDatabaseRuntime>({
  id: "conversations.database",
  test(provider) {
    if (!provider || typeof provider !== "object" || typeof provider.resolveDb !== "function") {
      throw new Error("conversations.database provider must implement resolveDb().")
    }
  },
})
export const conversationIngressSourcePort = definePort<ConversationIngressSource>({
  id: "conversations.ingress-source",
  test(provider) {
    if (
      !provider ||
      typeof provider !== "object" ||
      typeof provider.id !== "string" ||
      typeof provider.list !== "function" ||
      typeof provider.fetch !== "function" ||
      typeof provider.ack !== "function"
    ) {
      throw new Error(
        "conversations.ingress-source provider must implement list(), fetch(), and ack().",
      )
    }
  },
})
export const conversationsRenderedMessageAdmissionPort =
  definePort<ConversationsRenderedMessageAdmission>({
    id: "conversations.rendered-message-admission",
    test(provider) {
      if (
        !provider ||
        typeof provider !== "object" ||
        typeof provider.admitRenderedServiceMessage !== "function"
      ) {
        throw new Error(
          "conversations.rendered-message-admission provider must implement admitRenderedServiceMessage().",
        )
      }
    },
  })
export const conversationsPersonDirectoryPort = definePort<ConversationsPersonDirectory>({
  id: "conversations.person-directory",
  test(provider) {
    if (
      !provider ||
      typeof provider !== "object" ||
      typeof provider.resolveEmail !== "function" ||
      typeof provider.resolvePersonContactPoint !== "function"
    ) {
      throw new Error(
        "conversations.person-directory provider must implement read-only resolution methods.",
      )
    }
  },
})
