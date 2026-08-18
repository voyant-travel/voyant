import { describe, expect, it } from "vitest"
import type { InboundSmsEnvelopeV1 } from "../src/index.js"
import {
  canonicalEnvelopePayload,
  canonicalMessageId,
  inboundEmailEnvelopeV1Schema,
  inboundSmsEnvelopeV1Schema,
  normalizeE164,
} from "../src/index.js"

const envelope = {
  version: "1" as const,
  sourceId: "fixture-source",
  externalEnvelopeId: "envelope-1",
  externalMessageId: "external-1",
  sender: { address: "customer@example.test" },
  to: [{ address: "inbox@example.test" }],
  cc: [],
  replyTo: [],
  subject: "A question",
  text: "Hello",
  html: null,
  attachments: [],
  classification: "message" as const,
  threading: { messageId: "<message-1@example.test>", inReplyTo: null, references: [] },
  occurredAt: "2026-08-17T10:00:00.000Z",
}

describe("provider-neutral inbound email envelope", () => {
  it("accepts the versioned transport-free shape", () => {
    expect(inboundEmailEnvelopeV1Schema.parse(envelope)).toEqual(envelope)
  })

  it("canonicalizes object key order and message identifiers", () => {
    expect(canonicalEnvelopePayload(envelope)).toBe(canonicalEnvelopePayload({ ...envelope }))
    expect(canonicalMessageId(" <Message-1@Example.Test> ")).toBe("message-1@example.test")
  })
})

describe("provider-neutral inbound SMS envelope", () => {
  const sms: InboundSmsEnvelopeV1 = {
    version: "1",
    channel: "sms",
    sourceId: "fixture-source",
    externalEnvelopeId: "sms-envelope-1",
    externalMessageId: "sms-message-1",
    channelAccountId: "ncha_fixture",
    receivingAddress: "+12025550100",
    senderAddress: "+12025550123",
    text: "STOP",
    attachments: [],
    policyEvent: "hard_opt_out",
    adapterHandledResponse: true,
    occurredAt: "2026-08-17T10:00:00.000Z",
  }

  it("accepts a transport-free envelope and preserves adapter response audit metadata", () => {
    expect(inboundSmsEnvelopeV1Schema.parse(sms)).toEqual(sms)
    expect(canonicalEnvelopePayload(sms)).toBe(canonicalEnvelopePayload({ ...sms }))
  })

  it("uses strict E.164 rather than guessing a region or rewriting punctuation", () => {
    expect(normalizeE164(" +12025550123 ")).toBe("+12025550123")
    expect(() => normalizeE164("(202) 555-0123")).toThrow("E.164")
    expect(() => normalizeE164("+02025550123")).toThrow("E.164")
  })
})
