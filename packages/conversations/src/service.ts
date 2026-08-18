import {
  canonicalEnvelopePayload,
  canonicalMessageId,
  type InboundEmailEnvelopeV1,
  normalizeEmailAddress,
} from "@voyant-travel/conversations-contracts"
import { newId } from "@voyant-travel/db/lib/typeid"
import { insertOutboxEvents } from "@voyant-travel/db/outbox"
import { and, asc, desc, eq, gt, inArray, lte, or, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type {
  ConversationRenderedServiceMessage,
  ConversationsPersonDirectory,
  ConversationsRenderedMessageAdmission,
  ConversationsStaffDirectory,
} from "./runtime-port.js"
import {
  type Conversation,
  type ConversationEvent,
  type ConversationInbox,
  type ConversationNote,
  type ConversationPart,
  conversationEvents,
  conversationInboxes,
  conversationInboxMemberships,
  conversationIngressOperations,
  conversationNotes,
  conversationParticipants,
  conversationParts,
  conversationReadCursors,
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
  conversation: ConversationView
  parts: ConversationPart[]
  notes: ConversationNote[]
  timeline: ConversationTimelineItem[]
}

export type ConversationTimelineItem =
  | { kind: "part"; occurredAt: Date; id: string; part: ConversationPart }
  | { kind: "note"; occurredAt: Date; id: string; note: ConversationNote }
  | { kind: "system"; occurredAt: Date; id: string; event: ConversationEvent }

export type ConversationView = Conversation & { unreadCount: number }

export interface ConversationActor {
  userId: string
  correlationId?: string
}

function staffLookupContext(
  db: PostgresJsDatabase,
  actor: ConversationActor,
  runtimeBindings: unknown,
) {
  return {
    db: db as never,
    bindings:
      runtimeBindings && typeof runtimeBindings === "object"
        ? (runtimeBindings as Record<string, unknown>)
        : {},
    requesterUserId: actor.userId,
  }
}

export class ConversationAccessDeniedError extends Error {
  readonly code = "conversation_access_denied"
}

export class ConversationInvalidStateError extends Error {
  readonly code = "conversation_invalid_state"
}

/** Fingerprint every delivery-affecting field while excluding the generated Part id. */
export function conversationReplyFingerprint(message: ConversationRenderedServiceMessage): string {
  return JSON.stringify({ ...message, target: { ...message.target, id: "" } })
}

export async function listConversations(
  db: PostgresJsDatabase,
  query: {
    userId: string
    limit?: number
    status?: "open" | "closed" | "snoozed"
    inboxId?: string
    assignedToUserId?: string
  },
): Promise<ConversationView[]> {
  const filters = [
    eq(conversationInboxMemberships.userId, query.userId),
    eq(conversationInboxMemberships.active, true),
  ]
  if (query.status) filters.push(eq(conversations.status, query.status))
  if (query.inboxId) filters.push(eq(conversations.inboxId, query.inboxId))
  if (query.assignedToUserId)
    filters.push(eq(conversations.assignedToUserId, query.assignedToUserId))
  const rows = await db
    .select({ conversation: conversations })
    .from(conversations)
    .innerJoin(
      conversationInboxMemberships,
      eq(conversationInboxMemberships.inboxId, conversations.inboxId),
    )
    .where(and(...filters))
    .orderBy(desc(conversations.lastPartAt))
    .limit(Math.min(query.limit ?? 50, 100))
  return Promise.all(
    rows.map(({ conversation }) => withUnreadCount(db, conversation, query.userId)),
  )
}

export async function getConversation(
  db: PostgresJsDatabase,
  id: string,
  userId: string,
): Promise<ConversationDetail | null> {
  const [result] = await db
    .select({ conversation: conversations })
    .from(conversations)
    .innerJoin(
      conversationInboxMemberships,
      eq(conversationInboxMemberships.inboxId, conversations.inboxId),
    )
    .where(
      and(
        eq(conversations.id, id),
        eq(conversationInboxMemberships.userId, userId),
        eq(conversationInboxMemberships.active, true),
      ),
    )
    .limit(1)
  const conversation = result?.conversation
  if (!conversation) return null
  const parts = await db
    .select()
    .from(conversationParts)
    .where(eq(conversationParts.conversationId, id))
    .orderBy(conversationParts.sequence)
  const notes = await db
    .select()
    .from(conversationNotes)
    .where(eq(conversationNotes.conversationId, id))
    .orderBy(asc(conversationNotes.createdAt))
  const events = await db
    .select()
    .from(conversationEvents)
    .where(eq(conversationEvents.conversationId, id))
    .orderBy(asc(conversationEvents.occurredAt))
  const timeline: ConversationTimelineItem[] = [
    ...parts.map((part) => ({
      kind: "part" as const,
      occurredAt: part.occurredAt,
      id: part.id,
      part,
    })),
    ...notes.map((note) => ({
      kind: "note" as const,
      occurredAt: note.createdAt,
      id: note.id,
      note,
    })),
    ...events.map((event) => ({
      kind: "system" as const,
      occurredAt: event.occurredAt,
      id: event.id,
      event,
    })),
  ].sort((left, right) => {
    const time = left.occurredAt.getTime() - right.occurredAt.getTime()
    return time === 0 ? `${left.kind}:${left.id}`.localeCompare(`${right.kind}:${right.id}`) : time
  })
  return {
    conversation: await withUnreadCount(db, conversation, userId),
    parts,
    notes,
    timeline,
  }
}

async function withUnreadCount(
  db: PostgresJsDatabase,
  conversation: Conversation,
  userId: string,
): Promise<ConversationView> {
  const [cursor] = await db
    .select({ lastReadSequence: conversationReadCursors.lastReadSequence })
    .from(conversationReadCursors)
    .where(
      and(
        eq(conversationReadCursors.conversationId, conversation.id),
        eq(conversationReadCursors.userId, userId),
      ),
    )
    .limit(1)
  const [count] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(conversationParts)
    .where(
      and(
        eq(conversationParts.conversationId, conversation.id),
        eq(conversationParts.direction, "inbound"),
        gt(conversationParts.sequence, cursor?.lastReadSequence ?? 0),
      ),
    )
  return { ...conversation, unreadCount: count?.value ?? 0 }
}

async function assertInboxMembership(
  db: PostgresJsDatabase,
  conversationId: string,
  userId: string,
): Promise<Conversation> {
  const [row] = await db
    .select({ conversation: conversations })
    .from(conversations)
    .innerJoin(
      conversationInboxMemberships,
      eq(conversationInboxMemberships.inboxId, conversations.inboxId),
    )
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversationInboxMemberships.userId, userId),
        eq(conversationInboxMemberships.active, true),
      ),
    )
    .limit(1)
  if (!row)
    throw new ConversationAccessDeniedError("Conversation is outside the staff member's Inbox")
  return row.conversation
}

async function nextSequence(db: PostgresJsDatabase, conversationId: string): Promise<number> {
  const [row] = await db
    .update(conversations)
    .set({
      nextPartSequence: sql`${conversations.nextPartSequence} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(conversations.id, conversationId))
    .returning({ sequence: sql<number>`${conversations.nextPartSequence} - 1` })
  if (!row) throw new ConversationNotFoundError("Conversation not found")
  return row.sequence
}

async function appendChange(
  db: PostgresJsDatabase,
  input: {
    conversationId: string
    inboxId: string
    revision: number
    type: string
    actorUserId?: string | undefined
    correlationId?: string | undefined
    payload?: Record<string, unknown>
    occurredAt?: Date
  },
): Promise<void> {
  const occurredAt = input.occurredAt ?? new Date()
  await db.insert(conversationEvents).values({
    conversationId: input.conversationId,
    type: input.type,
    actorUserId: input.actorUserId,
    correlationId: input.correlationId,
    revision: input.revision,
    payload: input.payload ?? {},
    occurredAt,
  })
  await insertOutboxEvents(db as never, [
    {
      name: "conversation.changed",
      data: {
        conversationId: input.conversationId,
        inboxId: input.inboxId,
        revision: input.revision,
        change: input.type,
      },
      metadata: {
        ...(input.actorUserId ? { actorId: input.actorUserId } : {}),
        ...(input.correlationId ? { correlationId: input.correlationId } : {}),
      },
      emittedAt: occurredAt.toISOString(),
    },
  ])
}

async function defaultInboxId(db: PostgresJsDatabase): Promise<string> {
  const [row] = await db
    .select({ id: conversationInboxes.id })
    .from(conversationInboxes)
    .orderBy(desc(conversationInboxes.isDefault), asc(conversationInboxes.createdAt))
    .limit(1)
  if (row) return row.id
  const id = newId("conversation_inboxes")
  const [created] = await db
    .insert(conversationInboxes)
    .values({ id, name: "Inbox", isDefault: true })
    .onConflictDoNothing({ target: conversationInboxes.name })
    .returning({ id: conversationInboxes.id })
  if (created) return created.id
  const [raced] = await db
    .select({ id: conversationInboxes.id })
    .from(conversationInboxes)
    .where(eq(conversationInboxes.name, "Inbox"))
    .limit(1)
  if (!raced) throw new ConversationConflictError("Default Inbox provisioning failed")
  return raced.id
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
        inboxId: await defaultInboxId(tx as PostgresJsDatabase),
        subject: envelope.subject,
        suggestedSubject: envelope.subject,
        replyAlias: createReplyAlias(conversationId, receivingAddress),
        customerAddress: senderAddress,
        personRef: person?.personRef ?? null,
        contactPointRef: person?.contactPointRef ?? null,
        nextPartSequence: 2,
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
          revision: sql`${conversations.revision} + 1`,
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
      sequence: await currentOrAllocatedSequence(tx as PostgresJsDatabase, conversationId),
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
    const [current] = await tx
      .select({ inboxId: conversations.inboxId, revision: conversations.revision })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1)
    await appendChange(tx as PostgresJsDatabase, {
      conversationId,
      inboxId: current?.inboxId ?? (await defaultInboxId(tx as PostgresJsDatabase)),
      revision: current?.revision ?? 1,
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

async function currentOrAllocatedSequence(
  db: PostgresJsDatabase,
  conversationId: string,
): Promise<number> {
  const [conversation] = await db
    .select({ nextPartSequence: conversations.nextPartSequence })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1)
  if (!conversation) throw new ConversationNotFoundError("Conversation not found")
  if (conversation.nextPartSequence === 2) {
    const [existingPart] = await db
      .select({ id: conversationParts.id })
      .from(conversationParts)
      .where(eq(conversationParts.conversationId, conversationId))
      .limit(1)
    if (!existingPart) return 1
  }
  return nextSequence(db, conversationId)
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
    actor: ConversationActor
    channelAccountId: string
    text: string | null
    html?: string | null
    idempotencyKey: string
    runtimeBindings?: unknown
  },
): Promise<ConversationPart> {
  return db.transaction(async (transaction) => {
    const tx = transaction as PostgresJsDatabase
    const conversation = await assertInboxMembership(tx, input.conversationId, input.actor.userId)
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
    inboxId: string
    actor: ConversationActor
    runtimeBindings?: unknown
  },
): Promise<ConversationDetail> {
  const contact = await directory.resolvePersonContactPoint(db, input)
  if (!contact) throw new ConversationNotFoundError("Known Person contact point not found")
  const customerAddress = normalizeEmailAddress(contact.address)
  const [membership] = await db
    .select({ id: conversationInboxMemberships.id })
    .from(conversationInboxMemberships)
    .where(
      and(
        eq(conversationInboxMemberships.inboxId, input.inboxId),
        eq(conversationInboxMemberships.userId, input.actor.userId),
        eq(conversationInboxMemberships.active, true),
      ),
    )
    .limit(1)
  if (!membership) throw new ConversationAccessDeniedError("Staff member is not an Inbox member")
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
        inboxId: input.inboxId,
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
      actor: input.actor,
    })
    return id
  })
  const detail = await getConversation(db, conversationId, input.actor.userId)
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
    actor: ConversationActor
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
      sequence: await nextSequence(tx, conversation.id),
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
  const [updatedConversation] = await tx
    .update(conversations)
    .set({
      lastPartAt: now,
      revision: sql`${conversations.revision} + 1`,
      updatedAt: now,
    })
    .where(eq(conversations.id, conversation.id))
    .returning()
  await appendChange(tx, {
    conversationId: conversation.id,
    inboxId: updatedConversation?.inboxId ?? conversation.inboxId,
    revision: updatedConversation?.revision ?? conversation.revision + 1,
    type: "reply.admitted",
    actorUserId: input.actor.userId,
    correlationId: input.actor.correlationId,
    payload: { partId, deliveryId: admitted.deliveryId },
  })
  if (!part) throw new Error("Reply part disappeared during admission")
  return part
}

export async function updateConversationState(
  db: PostgresJsDatabase,
  id: string,
  input: {
    actor: ConversationActor
    revision: number
    status?: "open" | "closed" | "snoozed"
    snoozedUntil?: string | null
    priority?: "low" | "normal" | "high" | "urgent"
    assignedToUserId?: string | null
    inboxId?: string
    staffDirectory: ConversationsStaffDirectory
    runtimeBindings?: unknown
  },
): Promise<Conversation> {
  return db.transaction(async (transaction) => {
    const tx = transaction as PostgresJsDatabase
    const current = await assertInboxMembership(tx, id, input.actor.userId)
    const targetInboxId = input.inboxId ?? current.inboxId
    if (!targetInboxId) throw new ConversationInvalidStateError("Conversation has no Inbox")
    if (targetInboxId !== current.inboxId) {
      const [actorMembership] = await tx
        .select({ id: conversationInboxMemberships.id })
        .from(conversationInboxMemberships)
        .where(
          and(
            eq(conversationInboxMemberships.inboxId, targetInboxId),
            eq(conversationInboxMemberships.userId, input.actor.userId),
            eq(conversationInboxMemberships.active, true),
          ),
        )
        .limit(1)
      if (!actorMembership)
        throw new ConversationAccessDeniedError("Staff member cannot route to that Inbox")
    }
    if (input.assignedToUserId) {
      const [assigneeMembership] = await tx
        .select({ id: conversationInboxMemberships.id })
        .from(conversationInboxMemberships)
        .where(
          and(
            eq(conversationInboxMemberships.inboxId, targetInboxId),
            eq(conversationInboxMemberships.userId, input.assignedToUserId),
            eq(conversationInboxMemberships.active, true),
          ),
        )
        .limit(1)
      if (!assigneeMembership)
        throw new ConversationInvalidStateError("Assignee is not an Inbox member")
      if (
        !(await input.staffDirectory.isActiveStaff(
          staffLookupContext(tx, input.actor, input.runtimeBindings),
          input.assignedToUserId,
        ))
      ) {
        throw new ConversationInvalidStateError("Assignee is not active staff")
      }
    }
    const snoozedUntil =
      input.status === "snoozed" && input.snoozedUntil ? new Date(input.snoozedUntil) : null
    if (input.status === "snoozed" && (!snoozedUntil || snoozedUntil <= new Date())) {
      throw new ConversationInvalidStateError("Snooze expiry must be in the future")
    }
    const [row] = await tx
      .update(conversations)
      .set({
        ...(input.status ? { status: input.status } : {}),
        ...(input.status ? { snoozedUntil } : {}),
        ...(input.priority ? { priority: input.priority } : {}),
        ...(input.assignedToUserId !== undefined
          ? { assignedToUserId: input.assignedToUserId }
          : {}),
        ...(input.inboxId ? { inboxId: input.inboxId } : {}),
        revision: sql`${conversations.revision} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(conversations.id, id), eq(conversations.revision, input.revision)))
      .returning()
    if (!row) throw new ConversationConflictError("Conversation revision is stale")
    await appendChange(tx, {
      conversationId: row.id,
      inboxId: row.inboxId,
      revision: row.revision,
      type: "conversation.routed",
      actorUserId: input.actor.userId,
      correlationId: input.actor.correlationId,
      payload: {
        status: row.status,
        priority: row.priority,
        assignedToUserId: row.assignedToUserId,
        inboxId: row.inboxId,
      },
    })
    return row
  })
}

export async function markConversationRead(
  db: PostgresJsDatabase,
  id: string,
  actor: ConversationActor,
  throughSequence?: number,
): Promise<ConversationView> {
  const conversation = await assertInboxMembership(db, id, actor.userId)
  const maximum = Math.max(0, conversation.nextPartSequence - 1)
  const sequence = Math.min(throughSequence ?? maximum, maximum)
  await db
    .insert(conversationReadCursors)
    .values({ conversationId: id, userId: actor.userId, lastReadSequence: sequence })
    .onConflictDoUpdate({
      target: [conversationReadCursors.conversationId, conversationReadCursors.userId],
      set: {
        lastReadSequence: sql`greatest(${conversationReadCursors.lastReadSequence}, ${sequence})`,
        updatedAt: new Date(),
      },
    })
  return withUnreadCount(db, conversation, actor.userId)
}

export async function addConversationNote(
  db: PostgresJsDatabase,
  input: { conversationId: string; actor: ConversationActor; revision: number; body: string },
): Promise<ConversationNote> {
  return db.transaction(async (transaction) => {
    const tx = transaction as PostgresJsDatabase
    const conversation = await assertInboxMembership(tx, input.conversationId, input.actor.userId)
    const [updated] = await tx
      .update(conversations)
      .set({ revision: sql`${conversations.revision} + 1`, updatedAt: new Date() })
      .where(
        and(eq(conversations.id, input.conversationId), eq(conversations.revision, input.revision)),
      )
      .returning()
    if (!updated) throw new ConversationConflictError("Conversation revision is stale")
    const [note] = await tx
      .insert(conversationNotes)
      .values({
        conversationId: input.conversationId,
        authorUserId: input.actor.userId,
        body: input.body,
      })
      .returning()
    if (!note) throw new Error("Conversation note was not created")
    await appendChange(tx, {
      conversationId: input.conversationId,
      inboxId: conversation.inboxId,
      revision: updated.revision,
      type: "note.created",
      actorUserId: input.actor.userId,
      correlationId: input.actor.correlationId,
      payload: { noteId: note.id },
    })
    return note
  })
}

export async function listConversationInboxes(
  db: PostgresJsDatabase,
  userId: string,
): Promise<ConversationInbox[]> {
  const rows = await db
    .select({ inbox: conversationInboxes })
    .from(conversationInboxes)
    .innerJoin(
      conversationInboxMemberships,
      eq(conversationInboxMemberships.inboxId, conversationInboxes.id),
    )
    .where(
      and(
        eq(conversationInboxMemberships.userId, userId),
        eq(conversationInboxMemberships.active, true),
      ),
    )
    .orderBy(asc(conversationInboxes.name))
  return rows.map(({ inbox }) => inbox)
}

export async function createConversationInbox(
  db: PostgresJsDatabase,
  input: { actor: ConversationActor; name: string; description?: string | null },
): Promise<ConversationInbox> {
  return db.transaction(async (transaction) => {
    const tx = transaction as PostgresJsDatabase
    const [inbox] = await tx
      .insert(conversationInboxes)
      .values({ name: input.name, description: input.description ?? null })
      .returning()
    if (!inbox) throw new ConversationConflictError("Inbox name is already in use")
    await tx.insert(conversationInboxMemberships).values({
      inboxId: inbox.id,
      userId: input.actor.userId,
      role: "manager",
      active: true,
    })
    return inbox
  })
}

export async function claimDefaultConversationInbox(
  db: PostgresJsDatabase,
  actor: ConversationActor,
  staffDirectory: ConversationsStaffDirectory,
  runtimeBindings?: unknown,
): Promise<ConversationInbox> {
  if (
    !(await staffDirectory.isActiveStaff(
      staffLookupContext(db, actor, runtimeBindings),
      actor.userId,
    ))
  ) {
    throw new ConversationAccessDeniedError("Active staff access is required")
  }
  return db.transaction(async (transaction) => {
    const tx = transaction as PostgresJsDatabase
    const inboxId = await defaultInboxId(tx)
    const [inbox] = await tx
      .select()
      .from(conversationInboxes)
      .where(eq(conversationInboxes.id, inboxId))
      .limit(1)
    if (!inbox) throw new ConversationConflictError("Default Inbox disappeared")
    const [existingMember] = await tx
      .select({ id: conversationInboxMemberships.id })
      .from(conversationInboxMemberships)
      .where(
        and(
          eq(conversationInboxMemberships.inboxId, inboxId),
          eq(conversationInboxMemberships.active, true),
        ),
      )
      .limit(1)
    if (existingMember) {
      const [self] = await tx
        .select({ id: conversationInboxMemberships.id })
        .from(conversationInboxMemberships)
        .where(
          and(
            eq(conversationInboxMemberships.inboxId, inboxId),
            eq(conversationInboxMemberships.userId, actor.userId),
            eq(conversationInboxMemberships.active, true),
          ),
        )
        .limit(1)
      if (!self) throw new ConversationAccessDeniedError("Default Inbox already has managers")
      return inbox
    }
    await tx
      .insert(conversationInboxMemberships)
      .values({ inboxId, userId: actor.userId, role: "manager", active: true })
      .onConflictDoUpdate({
        target: [conversationInboxMemberships.inboxId, conversationInboxMemberships.userId],
        set: { role: "manager", active: true },
      })
    return inbox
  })
}

export async function setConversationInboxMembership(
  db: PostgresJsDatabase,
  input: {
    actor: ConversationActor
    inboxId: string
    userId: string
    role: "member" | "manager"
    active: boolean
    staffDirectory: ConversationsStaffDirectory
    runtimeBindings?: unknown
  },
): Promise<void> {
  const [manager] = await db
    .select({ id: conversationInboxMemberships.id })
    .from(conversationInboxMemberships)
    .where(
      and(
        eq(conversationInboxMemberships.inboxId, input.inboxId),
        eq(conversationInboxMemberships.userId, input.actor.userId),
        eq(conversationInboxMemberships.role, "manager"),
        eq(conversationInboxMemberships.active, true),
      ),
    )
    .limit(1)
  if (!manager) throw new ConversationAccessDeniedError("Inbox manager access is required")
  if (
    input.active &&
    !(await input.staffDirectory.isActiveStaff(
      staffLookupContext(db, input.actor, input.runtimeBindings),
      input.userId,
    ))
  ) {
    throw new ConversationInvalidStateError("Inbox member is not active staff")
  }
  await db
    .insert(conversationInboxMemberships)
    .values({
      inboxId: input.inboxId,
      userId: input.userId,
      role: input.role,
      active: input.active,
    })
    .onConflictDoUpdate({
      target: [conversationInboxMemberships.inboxId, conversationInboxMemberships.userId],
      set: { role: input.role, active: input.active },
    })
}

export async function listAssignableStaff(
  db: PostgresJsDatabase,
  inboxId: string,
  actorUserId: string,
  directory: ConversationsStaffDirectory,
  runtimeBindings?: unknown,
) {
  const [actorMembership] = await db
    .select({ id: conversationInboxMemberships.id })
    .from(conversationInboxMemberships)
    .where(
      and(
        eq(conversationInboxMemberships.inboxId, inboxId),
        eq(conversationInboxMemberships.userId, actorUserId),
        eq(conversationInboxMemberships.active, true),
      ),
    )
    .limit(1)
  if (!actorMembership) throw new ConversationAccessDeniedError("Inbox is not accessible")
  const memberships = await db
    .select({ userId: conversationInboxMemberships.userId })
    .from(conversationInboxMemberships)
    .where(
      and(
        eq(conversationInboxMemberships.inboxId, inboxId),
        eq(conversationInboxMemberships.active, true),
      ),
    )
  return directory.listActiveStaff(
    staffLookupContext(db, { userId: actorUserId }, runtimeBindings),
    { userIds: memberships.map(({ userId }) => userId) },
  )
}

export async function expireSnoozedConversations(
  db: PostgresJsDatabase,
  now = new Date(),
  limit = 100,
): Promise<number> {
  return db.transaction(async (transaction) => {
    const tx = transaction as PostgresJsDatabase
    const due = await tx
      .select()
      .from(conversations)
      .where(and(eq(conversations.status, "snoozed"), lte(conversations.snoozedUntil, now)))
      .orderBy(asc(conversations.snoozedUntil))
      .limit(limit)
    let expired = 0
    for (const conversation of due) {
      const [reopened] = await tx
        .update(conversations)
        .set({
          status: "open",
          snoozedUntil: null,
          revision: sql`${conversations.revision} + 1`,
          updatedAt: now,
        })
        .where(
          and(
            eq(conversations.id, conversation.id),
            eq(conversations.status, "snoozed"),
            eq(conversations.revision, conversation.revision),
          ),
        )
        .returning()
      if (reopened) {
        expired += 1
        await appendChange(tx, {
          conversationId: reopened.id,
          inboxId: reopened.inboxId,
          revision: reopened.revision,
          type: "conversation.snooze-expired",
        })
      }
    }
    return expired
  })
}
