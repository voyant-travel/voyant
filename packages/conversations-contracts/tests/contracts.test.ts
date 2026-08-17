import { describe, expect, it } from "vitest"
import {
  canonicalEnvelopePayload,
  canonicalMessageId,
  inboundEmailEnvelopeV1Schema,
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
