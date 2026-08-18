import type { StaffDirectoryRuntimeProvider } from "@voyant-travel/auth/ports"
import type {
  ConversationIngressSource,
  ConversationsRenderedMessageAdmission,
  InboundSmsEnvelopeV1,
} from "@voyant-travel/conversations-contracts"
import { definePort } from "@voyant-travel/core/project"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import type { ConversationsAttachmentRuntime } from "./attachment-runtime.js"

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
  resolvePhone(db: unknown, address: string): Promise<PersonEmailResolution>
  resolvePersonContactPoint(
    db: unknown,
    input: { personRef: string; contactPointRef: string; channel?: "email" | "sms" },
  ): Promise<{ address: string } | null>
}

export type ConversationsStaffDirectory = StaffDirectoryRuntimeProvider

export interface ConversationsChannelPolicy {
  inspectInboundSms(
    db: unknown,
    envelope: InboundSmsEnvelopeV1,
  ): Promise<
    | { kind: "ready"; accountId: string; normalizedAddress: string }
    | { kind: "missing" | "ambiguous" | "unavailable" }
  >
  projectInboundSmsPolicy(db: unknown, envelope: InboundSmsEnvelopeV1): Promise<void>
  getOutboundSmsState(
    db: unknown,
    input: { channelAccountId: string; destinationAddress: string },
  ): Promise<{
    normalizedAddress: string
    health: "unknown" | "healthy" | "degraded" | "unavailable"
    available: boolean
    attachmentsCapable: boolean
    suppressed: boolean
  } | null>
}

export type ConversationDeliveryTruth =
  | "pending"
  | "accepted"
  | "delivered"
  | "failed"
  | "bounced"
  | "complained"
  | "suppressed"
  | "cancelled"

/** Read-only projection. Notifications remains the sole delivery lifecycle authority. */
export interface ConversationsDeliveryTruthReader {
  getDeliveryTruth(
    db: unknown,
    deliveryIds: readonly string[],
  ): Promise<Readonly<Record<string, ConversationDeliveryTruth>>>
}

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
      typeof provider.resolvePhone !== "function" ||
      typeof provider.resolvePersonContactPoint !== "function"
    ) {
      throw new Error(
        "conversations.person-directory provider must implement read-only resolution methods.",
      )
    }
  },
})
export const conversationsAttachmentRuntimePort = definePort<ConversationsAttachmentRuntime>({
  id: "conversations.attachments",
  test(provider) {
    if (
      !provider ||
      typeof provider !== "object" ||
      typeof provider.download !== "function" ||
      typeof provider.delete !== "function" ||
      typeof provider.scan !== "function" ||
      typeof provider.resolveForSend !== "function"
    ) {
      throw new Error(
        "conversations.attachments provider must implement scan(), download(), delete(), and resolveForSend().",
      )
    }
    if (provider.createUploadTicket && typeof provider.finalizeUpload !== "function") {
      throw new Error("conversations.attachments upload capability requires finalizeUpload().")
    }
  },
})

export const conversationsChannelPolicyPort = definePort<ConversationsChannelPolicy>({
  id: "conversations.channel-policy",
  test(provider) {
    if (
      !provider ||
      typeof provider !== "object" ||
      typeof provider.inspectInboundSms !== "function" ||
      typeof provider.projectInboundSmsPolicy !== "function" ||
      typeof provider.getOutboundSmsState !== "function"
    ) {
      throw new Error("conversations.channel-policy provider must inspect and project SMS policy.")
    }
  },
})
export const conversationsDeliveryTruthPort = definePort<ConversationsDeliveryTruthReader>({
  id: "conversations.delivery-truth",
  test(provider) {
    if (
      !provider ||
      typeof provider !== "object" ||
      typeof provider.getDeliveryTruth !== "function"
    ) {
      throw new Error("conversations.delivery-truth provider must implement getDeliveryTruth().")
    }
  },
})
