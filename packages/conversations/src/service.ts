import {
  canonicalEnvelopePayload,
  canonicalMessageId,
  type InboundEmailEnvelopeV1,
  normalizeEmailAddress,
} from "@voyant-travel/conversations-contracts"
import { newId } from "@voyant-travel/db/lib/typeid"
import { and, desc, eq, inArray, or, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type {
  ConversationRenderedServiceMessage,
  ConversationsPersonDirectory,
  ConversationsRenderedMessageAdmission,
} from "./runtime-port.js"
import {
  type Conversation,
  type ConversationPart,
  conversationEvents,
  conversationIngressOperations,
  conversationParticipants,
  conversationParts,
  conversations,
} from "./schema.js"
import { createReplyAlias, inboundThreadIds, selectExactConversation } from "./threading.js"

export class ConversationIngressDriftError extends Error {
  readonly code = "ingress_payload_drift"
}

export class ConversationNotFoundError extends Error {
  readonly code = "conversation_not_found"
}

export class ConversationConflictError extends Error {
  readonly code = "conversation_conflict"
}

export interface ConversationDetail {
  conversation: Conversation
  parts: ConversationPart[]
}

/** Fingerprint every delivery-affecting field while excluding the generated Part id. */
export function conversationReplyFingerprint(message: ConversationRenderedServiceMessage): string {
  return JSON.stringify({ ...message, target: { ...message.target, id: "" } })
}

export async function listConversations(
  db: PostgresJsDatabase,
  query: { limit?: number; status?: "open" | "closed" | "snoozed" } = {},
): Promise<Conversation[]> {
  return db
    .select()
    .from(conversations)
    .where(query.status ? eq(conversations.status, query.status) : undefined)
    .orderBy(desc(conversations.lastPartAt))
    .limit(Math.min(query.limit ?? 50, 100))
}

export async function getConversation(
  db: PostgresJsDatabase,
  id: string,
): Promise<ConversationDetail | null> {
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id))
    .limit(1)
  if (!conversation) return null
  const parts = await db
    .select()
    .from(conversationParts)
    .where(eq(conversationParts.conversationId, id))
    .orderBy(conversationParts.occurredAt)
  return { conversation, parts }
}

/** Idempotently commit one provider-neutral envelope. Acknowledgement happens outside this transaction. */
export async function ingestEnvelope(
  db: PostgresJsDatabase,
  envelope: InboundEmailEnvelopeV1,
  options: { personDirectory?: ConversationsPersonDirectory } = {},
): Promise<{ conversationId: string; partId: string; duplicate: boolean }> {
  const fingerprint = canonicalEnvelopePayload(envelope)
  const result = await db.transaction(async (tx) => {
    const operationId = newId("conversation_ingress_operations")
    const [claimed] = await tx
      .insert(conversationIngressOperations)
      .values({
        id: operationId,
        sourceId: envelope.sourceId,
        externalEnvelopeId: envelope.externalEnvelopeId,
        externalMessageId: envelope.externalMessageId,
        payloadFingerprint: fingerprint,
        status: "committed",
      })
      .onConflictDoNothing()
      .returning({ id: conversationIngressOperations.id })
    if (!claimed) {
      const identities = await findIngressIdentities(tx as PostgresJsDatabase, envelope)
      if (identities.length === 0) {
        throw new ConversationConflictError(
          "Inbound identity claim was lost without a replay record",
        )
      }
      if (identities.some((identity) => identity.payloadFingerprint !== fingerprint)) {
        await tx
          .update(conversationIngressOperations)
          .set({
            status: "drifted",
            error: "A replay reused an identity with different content",
          })
          .where(
            inArray(
              conversationIngressOperations.id,
              identities.map(({ id }) => id),
            ),
          )
        return { kind: "drift" as const }
      }
      const existing = identities[0]!
      if (!existing.conversationPartId) {
        throw new ConversationConflictError("Committed ingress is missing its part")
      }
      const [part] = await tx
        .select({ conversationId: conversationParts.conversationId })
        .from(conversationParts)
        .where(eq(conversationParts.id, existing.conversationPartId))
        .limit(1)
      if (!part) throw new ConversationConflictError("Committed ingress references a missing part")
      return {
        kind: "result" as const,
        value: {
          conversationId: part.conversationId,
          partId: existing.conversationPartId,
          duplicate: true,
        },
      }
    }

    const aliasMatches = await exactAliasMatches(tx as PostgresJsDatabase, envelope)
    const headerMatches = await exactHeaderMatches(tx as PostgresJsDatabase, envelope)
    let conversationId = selectExactConversation({ aliasMatches, headerMatches })
    const occurredAt = new Date(envelope.occurredAt)
    const senderAddress = normalizeEmailAddress(envelope.sender.address)
    let resolution: Awaited<ReturnType<ConversationsPersonDirectory["resolveEmail"]>> = {
      kind: "none",
    }
    if (options.personDirectory)
      resolution = await options.personDirectory.resolveEmail(tx, senderAddress)

    if (!conversationId) {
      conversationId = newId("conversations")
      const receivingAddress = envelope.to[0]?.address
      if (!receivingAddress) throw new Error("Inbound email has no receiving address")
      const person = resolution.kind === "unique" ? resolution : null
      await tx.insert(conversations).values({
        id: conversationId,
        subject: envelope.subject,
        suggestedSubject: envelope.subject,
        replyAlias: createReplyAlias(conversationId, receivingAddress),
        customerAddress: senderAddress,
        personRef: person?.personRef ?? null,
        contactPointRef: person?.contactPointRef ?? null,
        unreadCount: 1,
        lastPartAt: occurredAt,
      })
      await tx.insert(conversationParticipants).values({
        conversationId,
        role: "customer",
        address: senderAddress,
        personRef: person?.personRef ?? null,
        contactPointRef: person?.contactPointRef ?? null,
      })
    } else {
      await tx
        .update(conversations)
        .set({
          status: "open",
          snoozedUntil: null,
          lastPartAt: occurredAt,
          unreadCount: sql`${conversations.unreadCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, conversationId))
    }

    const partId = newId("conversation_parts")
    const messageId = envelope.threading.messageId
      ? canonicalMessageId(envelope.threading.messageId)
      : null
    await tx.insert(conversationParts).values({
      id: partId,
      conversationId,
      direction: "inbound",
      senderAddress,
      recipientAddresses: [...envelope.to, ...envelope.cc].map(({ address }) =>
        normalizeEmailAddress(address),
      ),
      subject: envelope.subject,
      textBody: envelope.text,
      htmlBody: envelope.html,
      attachments: envelope.attachments,
      externalSourceId: envelope.sourceId,
      externalMessageId: envelope.externalMessageId,
      messageId,
      inReplyTo: envelope.threading.inReplyTo
        ? canonicalMessageId(envelope.threading.inReplyTo)
        : null,
      references: envelope.threading.references.map(canonicalMessageId),
      payloadFingerprint: fingerprint,
      deliveryStatus: "received",
      occurredAt,
    })
    await tx
      .update(conversationIngressOperations)
      .set({
        conversationPartId: partId,
        status: "committed",
        committedAt: new Date(),
      })
      .where(eq(conversationIngressOperations.id, operationId))
    await tx.insert(conversationEvents).values({
      conversationId,
      type: "part.received",
      payload: { partId, sourceId: envelope.sourceId },
      occurredAt,
    })
    return { kind: "result" as const, value: { conversationId, partId, duplicate: false } }
  })
  if (result.kind === "drift") {
    throw new ConversationIngressDriftError("Inbound identity was replayed with different content")
  }
  return result.value
}

async function findIngressIdentities(db: PostgresJsDatabase, envelope: InboundEmailEnvelopeV1) {
  return db
    .select()
    .from(conversationIngressOperations)
    .where(
      or(
        and(
          eq(conversationIngressOperations.sourceId, envelope.sourceId),
          eq(conversationIngressOperations.externalEnvelopeId, envelope.externalEnvelopeId),
        ),
        and(
          eq(conversationIngressOperations.sourceId, envelope.sourceId),
          eq(conversationIngressOperations.externalMessageId, envelope.externalMessageId),
        ),
      ),
    )
}

async function exactAliasMatches(
  db: PostgresJsDatabase,
  envelope: InboundEmailEnvelopeV1,
): Promise<string[]> {
  const recipients = [...envelope.to, ...envelope.cc].map(({ address }) =>
    normalizeEmailAddress(address),
  )
  if (recipients.length === 0) return []
  const rows = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(inArray(conversations.replyAlias, recipients))
  return rows.map(({ id }) => id)
}

async function exactHeaderMatches(
  db: PostgresJsDatabase,
  envelope: InboundEmailEnvelopeV1,
): Promise<string[]> {
  const identifiers = inboundThreadIds(envelope.threading)
  if (identifiers.length === 0) return []
  const rows = await db
    .select({ conversationId: conversationParts.conversationId })
    .from(conversationParts)
    .where(inArray(conversationParts.messageId, identifiers))
  return rows.map(({ conversationId }) => conversationId)
}

export async function replyToConversation(
  db: PostgresJsDatabase,
  admission: ConversationsRenderedMessageAdmission,
  input: {
    conversationId: string
    channelAccountId: string
    text: string | null
    html?: string | null
    idempotencyKey: string
    runtimeBindings?: unknown
  },
): Promise<ConversationPart> {
  return db.transaction(async (transaction) => {
    const tx = transaction as PostgresJsDatabase
    const [conversation] = await tx
      .select()
      .from(conversations)
      .where(eq(conversations.id, input.conversationId))
      .limit(1)
    if (!conversation) throw new ConversationNotFoundError("Conversation not found")
    return admitReplyWithinTransaction(tx, admission, conversation, input)
  })
}

export async function startConversation(
  db: PostgresJsDatabase,
  admission: ConversationsRenderedMessageAdmission,
  directory: ConversationsPersonDirectory,
  input: {
    personRef: string
    contactPointRef: string
    channelAccountId: string
    fromAddress: string
    subject: string | null
    text: string
    idempotencyKey: string
    runtimeBindings?: unknown
  },
): Promise<ConversationDetail> {
  const contact = await directory.resolvePersonContactPoint(db, input)
  if (!contact) throw new ConversationNotFoundError("Known Person contact point not found")
  const customerAddress = normalizeEmailAddress(contact.address)
  const startFingerprint = JSON.stringify({
    personRef: input.personRef,
    contactPointRef: input.contactPointRef,
    channelAccountId: input.channelAccountId,
    fromAddress: normalizeEmailAddress(input.fromAddress),
    customerAddress,
    subject: input.subject,
    text: input.text,
  })
  const conversationId = await db.transaction(async (transaction) => {
    const tx = transaction as PostgresJsDatabase
    const id = newId("conversations")
    const now = new Date()
    const [created] = await tx
      .insert(conversations)
      .values({
        id,
        subject: input.subject,
        suggestedSubject: null,
        replyAlias: createReplyAlias(id, input.fromAddress),
        customerAddress,
        personRef: input.personRef,
        contactPointRef: input.contactPointRef,
        startIdempotencyKey: input.idempotencyKey,
        startPayloadFingerprint: startFingerprint,
        lastPartAt: now,
      })
      .onConflictDoNothing({ target: conversations.startIdempotencyKey })
      .returning()
    if (!created) {
      const [existing] = await tx
        .select()
        .from(conversations)
        .where(eq(conversations.startIdempotencyKey, input.idempotencyKey))
        .limit(1)
      if (!existing) throw new ConversationConflictError("Conversation start claim was lost")
      if (existing.startPayloadFingerprint !== startFingerprint) {
        throw new ConversationConflictError(
          "Start idempotency key was reused with different content",
        )
      }
      return existing.id
    }
    await tx.insert(conversationParticipants).values({
      conversationId: id,
      role: "customer",
      address: customerAddress,
      personRef: input.personRef,
      contactPointRef: input.contactPointRef,
    })
    await admitReplyWithinTransaction(tx, admission, created, {
      conversationId: id,
      channelAccountId: input.channelAccountId,
      text: input.text,
      idempotencyKey: input.idempotencyKey,
      runtimeBindings: input.runtimeBindings,
    })
    return id
  })
  const detail = await getConversation(db, conversationId)
  if (!detail) throw new Error("Started conversation disappeared")
  return detail
}

async function admitReplyWithinTransaction(
  tx: PostgresJsDatabase,
  admission: ConversationsRenderedMessageAdmission,
  conversation: Conversation,
  input: {
    conversationId: string
    channelAccountId: string
    text: string | null
    html?: string | null
    idempotencyKey: string
    runtimeBindings?: unknown
  },
): Promise<ConversationPart> {
  const [lastPart] = await tx
    .select()
    .from(conversationParts)
    .where(eq(conversationParts.conversationId, conversation.id))
    .orderBy(desc(conversationParts.occurredAt))
    .limit(1)
  const [lastOutbound] = await tx
    .select()
    .from(conversationParts)
    .where(
      and(
        eq(conversationParts.conversationId, conversation.id),
        eq(conversationParts.direction, "outbound"),
      ),
    )
    .orderBy(desc(conversationParts.occurredAt))
    .limit(1)
  const references = lastPart?.messageId ? [...lastPart.references, lastPart.messageId] : []
  const message = {
    channelAccountId: input.channelAccountId,
    target: { type: "@voyant-travel/conversations#part" as const, id: "" },
    purpose: "conversation-reply" as const,
    idempotencyKey: input.idempotencyKey,
    to: conversation.customerAddress,
    ...(conversation.subject ? { subject: conversation.subject } : {}),
    ...(input.text ? { text: input.text } : {}),
    ...(input.html ? { sanitizedHtml: input.html } : {}),
    thread: {
      threadId: conversation.id,
      ...(lastOutbound?.notificationDeliveryId
        ? { replyToDeliveryId: lastOutbound.notificationDeliveryId }
        : {}),
    },
    metadata: {
      replyAlias: conversation.replyAlias,
      inReplyTo: lastPart?.messageId ?? null,
      references,
    },
  }
  const fingerprint = conversationReplyFingerprint(message)
  const partId = newId("conversation_parts")
  message.target.id = partId
  const now = new Date()
  const [inserted] = await tx
    .insert(conversationParts)
    .values({
      id: partId,
      conversationId: conversation.id,
      direction: "outbound",
      senderAddress: conversation.replyAlias,
      recipientAddresses: [conversation.customerAddress],
      subject: conversation.subject,
      textBody: input.text,
      htmlBody: input.html ?? null,
      payloadFingerprint: fingerprint,
      idempotencyKey: input.idempotencyKey,
      deliveryStatus: "pending",
      occurredAt: now,
      inReplyTo: lastPart?.messageId ?? null,
      references,
    })
    .onConflictDoNothing({ target: conversationParts.idempotencyKey })
    .returning()
  if (!inserted) {
    const [existing] = await tx
      .select()
      .from(conversationParts)
      .where(eq(conversationParts.idempotencyKey, input.idempotencyKey))
      .limit(1)
    if (!existing) throw new ConversationConflictError("Reply idempotency claim was lost")
    if (existing.payloadFingerprint !== fingerprint) {
      throw new ConversationConflictError("Reply idempotency key was reused with different content")
    }
    return existing
  }
  let admitted: Awaited<
    ReturnType<ConversationsRenderedMessageAdmission["admitRenderedServiceMessage"]>
  >
  try {
    admitted = await admission.admitRenderedServiceMessage(tx, message, {
      bindings: input.runtimeBindings,
    })
  } catch {
    throw new ConversationConflictError("Rendered message admission was rejected")
  }
  const [part] = await tx
    .update(conversationParts)
    .set({
      notificationDeliveryId: admitted.deliveryId,
      deliveryStatus: admitted.state,
    })
    .where(eq(conversationParts.id, partId))
    .returning()
  await tx
    .update(conversations)
    .set({ lastPartAt: now, updatedAt: now })
    .where(eq(conversations.id, conversation.id))
  await tx.insert(conversationEvents).values({
    conversationId: conversation.id,
    type: "reply.admitted",
    payload: { partId, deliveryId: admitted.deliveryId },
  })
  if (!part) throw new Error("Reply part disappeared during admission")
  return part
}

export async function updateConversationState(
  db: PostgresJsDatabase,
  id: string,
  input: { status: "open" | "closed" | "snoozed"; snoozedUntil?: string | null },
): Promise<Conversation> {
  const [row] = await db
    .update(conversations)
    .set({
      status: input.status,
      snoozedUntil:
        input.status === "snoozed" && input.snoozedUntil ? new Date(input.snoozedUntil) : null,
      updatedAt: new Date(),
    })
    .where(eq(conversations.id, id))
    .returning()
  if (!row) throw new ConversationNotFoundError("Conversation not found")
  return row
}

export async function markConversationRead(
  db: PostgresJsDatabase,
  id: string,
): Promise<Conversation> {
  const [row] = await db
    .update(conversations)
    .set({ unreadCount: 0, updatedAt: new Date() })
    .where(eq(conversations.id, id))
    .returning()
  if (!row) throw new ConversationNotFoundError("Conversation not found")
  return row
}
