import { newId } from "@voyant-travel/db/lib/typeid"
import { cleanupTestDb, createTestDb } from "@voyant-travel/db/test-utils"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"
import { createPersonTimelineRuntime } from "../../src/person-timeline-runtime.js"
import {
  conversationInboxes,
  conversationInboxMemberships,
  conversationParts,
  conversations,
} from "../../src/schema.js"

const DB_AVAILABLE = Boolean(process.env.TEST_DATABASE_URL)

describe.skipIf(!DB_AVAILABLE)("Person timeline Conversations projection", () => {
  const db = createTestDb()
  const runtime = createPersonTimelineRuntime()
  const personId = "person-survivor"
  const actorUserId = "staff-authorized"

  beforeAll(async () => cleanupTestDb(db))
  beforeEach(async () => {
    await cleanupTestDb(db)
    const allowedInbox = newId("conversation_inboxes")
    const deniedInbox = newId("conversation_inboxes")
    await db.insert(conversationInboxes).values([
      { id: allowedInbox, name: "Allowed", isDefault: true },
      { id: deniedInbox, name: "Denied" },
    ])
    await db.insert(conversationInboxMemberships).values({
      inboxId: allowedInbox,
      userId: actorUserId,
      active: true,
    })
    for (const [index, inboxId] of [allowedInbox, deniedInbox].entries()) {
      const conversationId = newId("conversations")
      await db.insert(conversations).values({
        id: conversationId,
        inboxId,
        personRef: personId,
        replyAlias: `reply-${index}@example.test`,
        customerAddress: "customer@example.test",
        lastPartAt: new Date("2026-08-18T10:00:00Z"),
      })
      await db.insert(conversationParts).values({
        conversationId,
        sequence: 1,
        direction: "outbound",
        senderAddress: "reply@example.test",
        recipientAddresses: ["customer@example.test"],
        subject: "Private subject",
        textBody: index === 0 ? "Authorized body" : "Denied body",
        payloadFingerprint: `part-${index}`,
        notificationDeliveryId: `delivery-${index}`,
        admissionStatus: "admitted",
        occurredAt: new Date("2026-08-18T10:00:00Z"),
      })
    }
  })

  it("requires active Inbox membership for parts and linked-delivery dedupe", async () => {
    const query = { limit: 20, actorUserId }
    const parts = await runtime.listPersonParts(db, personId, query)
    expect(parts).toHaveLength(1)
    expect(parts[0]).toMatchObject({ body: "Authorized body", deliveryStatus: null })
    await expect(
      runtime.findLinkedDeliveryIds(db, personId, ["delivery-0", "delivery-1"], actorUserId),
    ).resolves.toEqual(["delivery-0"])
  })

  it("never projects quarantined, redacted, or classified transport content", async () => {
    const [part] = await db.select().from(conversationParts).limit(1)
    await db.update(conversationParts).set({ contentStatus: "redacted", textBody: "must-not-leak" })
    expect(await runtime.listPersonParts(db, personId, { limit: 20, actorUserId })).toEqual([
      expect.objectContaining({ id: part!.id, subject: null, body: null }),
    ])
    await db.update(conversationParts).set({ contentStatus: "quarantined" })
    expect(await runtime.listPersonParts(db, personId, { limit: 20, actorUserId })).toEqual([])
    await db
      .update(conversationParts)
      .set({ contentStatus: "safe", classification: "automatic_reply" })
    expect(await runtime.listPersonParts(db, personId, { limit: 20, actorUserId })).toEqual([])
  })

  it("moves losing Person history through the Conversations-owned merge hook", async () => {
    await runtime.mergePersonHistory(db, personId, "person-loser")
    await runtime.mergePersonHistory(db, "person-new-survivor", personId)
    expect(
      await runtime.listPersonParts(db, "person-new-survivor", { limit: 20, actorUserId }),
    ).toHaveLength(1)
  })
})
