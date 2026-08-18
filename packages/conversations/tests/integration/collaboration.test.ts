import type { InboundEmailEnvelopeV1 } from "@voyant-travel/conversations-contracts"
import { newId } from "@voyant-travel/db/lib/typeid"
import { eventOutboxTable } from "@voyant-travel/db/schema/infra/event_outbox"
import { cleanupTestDb, createTestDb } from "@voyant-travel/db/test-utils"
import { and, eq, like } from "drizzle-orm"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"
import {
  conversationEvents,
  conversationInboxes,
  conversationInboxMemberships,
  conversationNotes,
  conversationParts,
  conversationReadCursors,
  conversations,
} from "../../src/schema.js"
import {
  addConversationNote,
  ConversationConflictError,
  expireSnoozedConversations,
  ingestEnvelope,
  listConversations,
  markConversationRead,
  updateConversationState,
} from "../../src/service.js"

const DB_AVAILABLE = Boolean(
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.TEST_DATABASE_URL,
)

describe.skipIf(!DB_AVAILABLE)("Inbox collaboration persistence", () => {
  const db = createTestDb()
  const firstUser = "staff-first"
  const secondUser = "staff-second"
  let inboxId: string
  let conversationId: string
  const staffDirectory = {
    isActiveStaff: async () => true,
    listActiveStaff: async () => [],
  }

  beforeAll(async () => cleanupTestDb(db))
  beforeEach(async () => {
    await cleanupTestDb(db)
    inboxId = newId("conversation_inboxes")
    conversationId = newId("conversations")
    await db.insert(conversationInboxes).values({ id: inboxId, name: "General", isDefault: true })
    await db.insert(conversationInboxMemberships).values([
      { inboxId, userId: firstUser, role: "manager", active: true },
      { inboxId, userId: secondUser, role: "member", active: true },
    ])
    await db.insert(conversations).values({
      id: conversationId,
      inboxId,
      replyAlias: "reply@example.test",
      customerAddress: "customer@example.test",
      subject: "Help",
      lastPartAt: new Date("2026-08-18T10:00:00.000Z"),
      nextPartSequence: 3,
    })
    await db.insert(conversationParts).values([
      {
        conversationId,
        sequence: 1,
        direction: "inbound",
        senderAddress: "customer@example.test",
        recipientAddresses: ["reply@example.test"],
        payloadFingerprint: "one",
        deliveryStatus: "received",
        occurredAt: new Date("2026-08-18T10:00:00.000Z"),
      },
      {
        conversationId,
        sequence: 2,
        direction: "inbound",
        senderAddress: "customer@example.test",
        recipientAddresses: ["reply@example.test"],
        payloadFingerprint: "two",
        deliveryStatus: "received",
        occurredAt: new Date("2026-08-18T10:01:00.000Z"),
      },
    ])
  })

  it("keeps independent monotonic read cursors per staff member", async () => {
    await markConversationRead(db, conversationId, { userId: firstUser }, 2)
    await markConversationRead(db, conversationId, { userId: firstUser }, 1)

    const first = await listConversations(db, { userId: firstUser })
    const second = await listConversations(db, { userId: secondUser })
    expect(first[0]?.unreadCount).toBe(0)
    expect(second[0]?.unreadCount).toBe(2)

    const [cursor] = await db
      .select()
      .from(conversationReadCursors)
      .where(
        and(
          eq(conversationReadCursors.conversationId, conversationId),
          eq(conversationReadCursors.userId, firstUser),
        ),
      )
    expect(cursor?.lastReadSequence).toBe(2)
  })

  it("rejects stale lifecycle and stale note revisions", async () => {
    await updateConversationState(db, conversationId, {
      actor: { userId: firstUser },
      revision: 1,
      priority: "high",
      staffDirectory,
    })
    await expect(
      updateConversationState(db, conversationId, {
        actor: { userId: firstUser },
        revision: 1,
        status: "closed",
        staffDirectory,
      }),
    ).rejects.toBeInstanceOf(ConversationConflictError)
    await expect(
      addConversationNote(db, {
        conversationId,
        actor: { userId: firstUser },
        revision: 1,
        body: "stale note",
      }),
    ).rejects.toBeInstanceOf(ConversationConflictError)
    expect(await db.select().from(conversationNotes)).toHaveLength(0)
  })

  it("persists notes without accepting a delivery", async () => {
    const partsBefore = await db.select().from(conversationParts)
    const note = await addConversationNote(db, {
      conversationId,
      actor: { userId: firstUser },
      revision: 1,
      body: "Only staff should see this",
    })
    expect(note.body).toBe("Only staff should see this")
    expect(await db.select().from(conversationNotes)).toHaveLength(1)
    expect(await db.select().from(conversationParts)).toHaveLength(partsBefore.length)
    expect(
      (await db.select().from(conversationParts)).filter((part) => part.notificationDeliveryId),
    ).toHaveLength(0)
    expect(
      await db.select().from(conversationEvents).where(eq(conversationEvents.type, "note.created")),
    ).toHaveLength(1)
    expect(
      await db
        .select()
        .from(eventOutboxTable)
        .where(eq(eventOutboxTable.name, "conversation.changed")),
    ).toHaveLength(1)
    expect(
      await db.select().from(eventOutboxTable).where(like(eventOutboxTable.name, "notification.%")),
    ).toHaveLength(0)
  })

  it("excludes inactive memberships and rejects inactive or nonmember assignees", async () => {
    await db
      .update(conversationInboxMemberships)
      .set({ active: false })
      .where(
        and(
          eq(conversationInboxMemberships.inboxId, inboxId),
          eq(conversationInboxMemberships.userId, secondUser),
        ),
      )
    await expect(listConversations(db, { userId: secondUser })).resolves.toEqual([])

    for (const assignedToUserId of [secondUser, "staff-nonmember"]) {
      await expect(
        updateConversationState(db, conversationId, {
          actor: { userId: firstUser },
          revision: 1,
          assignedToUserId,
          staffDirectory,
        }),
      ).rejects.toMatchObject({ code: "conversation_invalid_state" })
    }
    await db
      .update(conversationInboxMemberships)
      .set({ active: true })
      .where(
        and(
          eq(conversationInboxMemberships.inboxId, inboxId),
          eq(conversationInboxMemberships.userId, secondUser),
        ),
      )
    await expect(
      updateConversationState(db, conversationId, {
        actor: { userId: firstUser },
        revision: 1,
        assignedToUserId: secondUser,
        staffDirectory: { ...staffDirectory, isActiveStaff: async () => false },
      }),
    ).rejects.toMatchObject({ code: "conversation_invalid_state" })
  })

  it("expires snoozes and reopens inbound replies without losing routing", async () => {
    await db
      .update(conversations)
      .set({
        status: "snoozed",
        snoozedUntil: new Date("2026-08-18T09:00:00.000Z"),
        assignedToUserId: secondUser,
      })
      .where(eq(conversations.id, conversationId))
    await expect(
      expireSnoozedConversations(db, new Date("2026-08-18T10:00:00.000Z")),
    ).resolves.toBe(1)

    await db
      .update(conversations)
      .set({ status: "snoozed", snoozedUntil: new Date("2026-08-19T10:00:00.000Z") })
      .where(eq(conversations.id, conversationId))
    const envelope: InboundEmailEnvelopeV1 = {
      version: "1",
      sourceId: "source",
      externalEnvelopeId: "envelope-3",
      externalMessageId: "message-3",
      sender: { address: "customer@example.test" },
      to: [{ address: "reply@example.test" }],
      cc: [],
      replyTo: [],
      subject: "Re: Help",
      text: "Following up",
      html: null,
      attachments: [],
      threading: { messageId: "message-3", inReplyTo: null, references: [] },
      occurredAt: "2026-08-18T10:05:00.000Z",
    }
    await ingestEnvelope(db, envelope)
    const [row] = await db.select().from(conversations).where(eq(conversations.id, conversationId))
    expect(row).toMatchObject({
      status: "open",
      inboxId,
      assignedToUserId: secondUser,
    })
  })
})
