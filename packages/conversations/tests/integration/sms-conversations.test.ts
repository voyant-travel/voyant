import type { InboundSmsEnvelopeV1 } from "@voyant-travel/conversations-contracts"
import { createTestDb } from "@voyant-travel/db/test-utils"
import { eq, sql } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ConversationsChannelPolicy } from "../../src/runtime-port.js"
import { conversationEvents, conversationParts, conversations } from "../../src/schema.js"
import {
  ConversationConflictError,
  ingestEnvelope,
  replyToConversation,
  startConversation,
} from "../../src/service.js"

const DB_AVAILABLE = !!(globalThis as { process?: { env?: Record<string, string | undefined> } })
  .process?.env?.TEST_DATABASE_URL
const db = DB_AVAILABLE ? createTestDb() : (null as never)

function sms(
  externalMessageId: string,
  overrides: Partial<InboundSmsEnvelopeV1> = {},
): InboundSmsEnvelopeV1 {
  return {
    version: "1",
    channel: "sms",
    sourceId: "fixture-source",
    externalEnvelopeId: `envelope-${externalMessageId}`,
    externalMessageId,
    channelAccountId: "ncha_fixture_1",
    receivingAddress: "+12025550100",
    senderAddress: "+12025550123",
    text: "Hello",
    attachments: [],
    policyEvent: null,
    adapterHandledResponse: false,
    occurredAt: "2026-08-17T10:00:00.000Z",
    ...overrides,
  }
}

const readyPolicy: ConversationsChannelPolicy = {
  async inspectInboundSms(_db, envelope) {
    return {
      kind: "ready",
      accountId: envelope.channelAccountId,
      normalizedAddress: envelope.receivingAddress,
    }
  },
  async projectInboundSmsPolicy() {},
  async getOutboundSmsState() {
    return {
      normalizedAddress: "+12025550100",
      health: "healthy",
      available: true,
      attachmentsCapable: false,
      suppressed: false,
    }
  },
}

describe.skipIf(!DB_AVAILABLE)("SMS conversation integration", () => {
  beforeEach(async () => {
    await db.execute(sql`
      TRUNCATE
        conversation_ingress_operations,
        conversation_events,
        conversation_parts,
        conversation_participants,
        conversations
      CASCADE
    `)
  })

  it("fails closed for an ambiguous receiving identity", async () => {
    const policy: ConversationsChannelPolicy = {
      ...readyPolicy,
      async inspectInboundSms() {
        return { kind: "ambiguous" }
      },
    }
    await expect(
      ingestEnvelope(db, sms("ambiguous"), { channelPolicy: policy }),
    ).rejects.toBeInstanceOf(ConversationConflictError)
    expect(await db.select().from(conversationParts)).toHaveLength(0)
  })

  it("resolves the remote phone through the channel-aware read-only Person port", async () => {
    const resolvePhone = vi.fn(async () => ({
      kind: "unique" as const,
      personRef: "pers_fixture",
      contactPointRef: "icpt_fixture",
      address: "+12025550123",
    }))
    const result = await ingestEnvelope(db, sms("person-resolution"), {
      channelPolicy: readyPolicy,
      personDirectory: {
        resolveEmail: async () => ({ kind: "none" }),
        resolvePhone,
        resolvePersonContactPoint: async () => null,
      },
    })
    expect(resolvePhone).toHaveBeenCalledWith(expect.anything(), "+12025550123")
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, result.conversationId))
    expect(conversation).toMatchObject({
      personRef: "pers_fixture",
      contactPointRef: "icpt_fixture",
    })
  })

  it("commits duplicate ingress once and converges concurrent messages on one account pair", async () => {
    const first = await ingestEnvelope(db, sms("duplicate"), { channelPolicy: readyPolicy })
    const replay = await ingestEnvelope(db, sms("duplicate"), { channelPolicy: readyPolicy })
    expect(replay).toEqual({ ...first, duplicate: true })

    const [left, right] = await Promise.all([
      ingestEnvelope(db, sms("concurrent-left"), { channelPolicy: readyPolicy }),
      ingestEnvelope(db, sms("concurrent-right"), { channelPolicy: readyPolicy }),
    ])
    expect(left.conversationId).toBe(first.conversationId)
    expect(right.conversationId).toBe(first.conversationId)
    expect(await db.select().from(conversations)).toHaveLength(1)
    expect(await db.select().from(conversationParts)).toHaveLength(3)
    expect(await db.select().from(conversationEvents)).toHaveLength(3)
  })

  it("separates Channel Accounts and reopens only a recently closed pair", async () => {
    const first = await ingestEnvelope(db, sms("first"), { channelPolicy: readyPolicy })
    await db
      .update(conversations)
      .set({ status: "closed", closedAt: new Date("2026-07-20T10:00:00.000Z") })
      .where(eq(conversations.id, first.conversationId))
    const reopened = await ingestEnvelope(db, sms("recent"), { channelPolicy: readyPolicy })
    expect(reopened.conversationId).toBe(first.conversationId)

    await db
      .update(conversations)
      .set({ status: "closed", closedAt: new Date("2026-07-01T10:00:00.000Z") })
      .where(eq(conversations.id, first.conversationId))
    const newer = await ingestEnvelope(db, sms("old-closed"), { channelPolicy: readyPolicy })
    expect(newer.conversationId).not.toBe(first.conversationId)

    const otherAccount = await ingestEnvelope(
      db,
      sms("other-account", {
        channelAccountId: "ncha_fixture_2",
        receivingAddress: "+12025550101",
      }),
      { channelPolicy: readyPolicy },
    )
    expect(otherAccount.conversationId).not.toBe(newer.conversationId)
  })

  it("does not regress thread ordering when an older message arrives late", async () => {
    const recent = await ingestEnvelope(
      db,
      sms("recent-order", { occurredAt: "2026-08-17T11:00:00.000Z" }),
      { channelPolicy: readyPolicy },
    )
    await ingestEnvelope(db, sms("late-order", { occurredAt: "2026-08-17T09:00:00.000Z" }), {
      channelPolicy: readyPolicy,
    })
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, recent.conversationId))
    expect(conversation?.lastPartAt.toISOString()).toBe("2026-08-17T11:00:00.000Z")
  })

  it("admits a retry-safe reply once and keeps only admission truth on the Part", async () => {
    const inbound = await ingestEnvelope(db, sms("reply"), { channelPolicy: readyPolicy })
    const admit = vi.fn(async () => ({ deliveryId: "ntdl_fixture", state: "pending" as const }))
    const input = {
      conversationId: inbound.conversationId,
      actor: { userId: "user_fixture" },
      channelAccountId: "ncha_fixture_1",
      text: "A reply",
      idempotencyKey: "reply-once",
    }
    const first = await replyToConversation(db, { admitRenderedServiceMessage: admit }, input)
    const replay = await replyToConversation(db, { admitRenderedServiceMessage: admit }, input)
    expect(replay.id).toBe(first.id)
    expect(first.admissionStatus).toBe("admitted")
    expect(admit).toHaveBeenCalledOnce()
  })

  it("derives the SMS sender from the authoritative Channel Account", async () => {
    const admit = vi.fn(async () => ({ deliveryId: "ntdl_start", state: "pending" as const }))
    const detail = await startConversation(
      db,
      { admitRenderedServiceMessage: admit },
      {
        resolveEmail: async () => ({ kind: "none" }),
        resolvePersonContactPoint: async () => ({ address: "+12025550123" }),
      },
      {
        channel: "sms",
        inboxId: "cinb_fixture",
        actor: { userId: "user_fixture" },
        personRef: "pers_fixture",
        contactPointRef: "icpt_fixture",
        channelAccountId: "ncha_fixture_1",
        text: "Hello",
        idempotencyKey: "start-authoritative-sender",
      },
      readyPolicy,
    )
    expect(detail.conversation.localAddress).toBe("+12025550100")
    expect(detail.parts[0]?.senderAddress).toBe("+12025550100")
  })
})
