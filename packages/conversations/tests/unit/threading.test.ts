import { describe, expect, it } from "vitest"
import { conversationReplyFingerprint } from "../../src/service.js"
import {
  createReplyAlias,
  inboundThreadIds,
  isSmsConversationRecentlyClosed,
  selectExactConversation,
  smsConversationPairKey,
} from "../../src/threading.js"

describe("exact email threading", () => {
  it("selects an exact alias or standard header identity", () => {
    expect(selectExactConversation({ aliasMatches: ["conv_1"], headerMatches: [] })).toBe("conv_1")
    expect(selectExactConversation({ aliasMatches: [], headerMatches: ["conv_1"] })).toBe("conv_1")
    expect(selectExactConversation({ aliasMatches: ["conv_1"], headerMatches: ["conv_1"] })).toBe(
      "conv_1",
    )
  })

  it("fails closed when exact identities disagree", () => {
    expect(() =>
      selectExactConversation({ aliasMatches: ["conv_1"], headerMatches: ["conv_2"] }),
    ).toThrow("disagree")
  })

  it("has no subject input and therefore cannot thread by normalized subject", () => {
    expect(selectExactConversation({ aliasMatches: [], headerMatches: [] })).toBeNull()
  })

  it("canonicalizes In-Reply-To and References and creates opaque aliases", () => {
    expect(
      inboundThreadIds({
        inReplyTo: "<First@Example.Test>",
        references: ["first@example.test", "<Second@Example.Test>"],
      }),
    ).toEqual(["first@example.test", "second@example.test"])
    expect(createReplyAlias("conv_opaque", "Inbox@Example.Test")).toBe(
      "inbox+conv_opaque@example.test",
    )
  })
})

describe("SMS pair threading", () => {
  it("separates Channel Accounts and normalized remote numbers", () => {
    expect(smsConversationPairKey("account_1", "+12025550123")).toBe(
      smsConversationPairKey("account_1", " +12025550123 "),
    )
    expect(smsConversationPairKey("account_1", "+12025550123")).not.toBe(
      smsConversationPairKey("account_2", "+12025550123"),
    )
    expect(() => smsConversationPairKey("account_1", "customer@example.test")).toThrow("E.164")
  })

  it("reopens at the 30-day boundary, but not older or future closed threads", () => {
    const inbound = new Date("2026-08-17T10:00:00.000Z")
    expect(isSmsConversationRecentlyClosed(new Date("2026-07-18T10:00:00.000Z"), inbound)).toBe(
      true,
    )
    expect(isSmsConversationRecentlyClosed(new Date("2026-07-18T09:59:59.999Z"), inbound)).toBe(
      false,
    )
    expect(isSmsConversationRecentlyClosed(new Date("2026-08-17T10:00:01.000Z"), inbound)).toBe(
      false,
    )
  })
})

describe("reply idempotency fingerprint", () => {
  const message = {
    channelAccountId: "account_1",
    target: { type: "@voyant-travel/conversations#part" as const, id: "part_generated" },
    purpose: "conversation-reply" as const,
    idempotencyKey: "reply_1",
    to: "customer@example.test",
    subject: "Subject",
    text: "Body",
    thread: { threadId: "conversation_1", replyToDeliveryId: "delivery_1" },
    metadata: {
      replyAlias: "reply+opaque@example.test",
      inReplyTo: "message_1",
      references: ["message_1"],
    },
  }

  it("covers the channel account and every delivery-affecting input but not generated Part id", () => {
    const fingerprint = conversationReplyFingerprint(message)
    expect(
      conversationReplyFingerprint({ ...message, target: { ...message.target, id: "part_retry" } }),
    ).toBe(fingerprint)
    expect(conversationReplyFingerprint({ ...message, channelAccountId: "account_2" })).not.toBe(
      fingerprint,
    )
    expect(conversationReplyFingerprint({ ...message, to: "other@example.test" })).not.toBe(
      fingerprint,
    )
    expect(conversationReplyFingerprint({ ...message, text: "Changed" })).not.toBe(fingerprint)
    expect(
      conversationReplyFingerprint({
        ...message,
        metadata: { ...message.metadata, replyAlias: "other@example.test" },
      }),
    ).not.toBe(fingerprint)
    expect(
      conversationReplyFingerprint({ ...message, thread: { threadId: "conversation_1" } }),
    ).not.toBe(fingerprint)
  })
})
