import type { InboundEmailEnvelopeV1 } from "@voyant-travel/conversations-contracts"
import { describe, expect, it, vi } from "vitest"
import { processConversationIngress } from "../../src/ingress-job.js"

const envelope: InboundEmailEnvelopeV1 = {
  version: "1",
  sourceId: "source",
  externalEnvelopeId: "env-1",
  externalMessageId: "message-1",
  sender: { address: "customer@example.test" },
  to: [{ address: "inbox@example.test" }],
  cc: [],
  replyTo: [],
  subject: "Hello",
  text: "Question",
  html: null,
  attachments: [],
  classification: "message",
  threading: { messageId: "<message-1@example.test>", inReplyTo: null, references: [] },
  occurredAt: "2026-08-17T10:00:00.000Z",
}

describe("durable ingress list/fetch/ack", () => {
  it("leaves an item unacknowledged when interruption happens after commit and acknowledges duplicate replay", async () => {
    let duplicate = false
    const ack = vi
      .fn()
      .mockRejectedValueOnce(new Error("process interrupted"))
      .mockResolvedValue(undefined)
    const source = {
      id: "source",
      list: vi.fn(async () => ({ items: [{ id: "env-1" }] })),
      fetch: vi.fn(async () => envelope),
      ack,
    }
    const ingest = vi.fn(async () => {
      const isDuplicate = duplicate
      duplicate = true
      return {
        conversationId: "conv_1",
        partId: "part_1",
        duplicate: isDuplicate,
      }
    })
    await expect(
      processConversationIngress({ db: {} as never, sources: [source], ingest }),
    ).rejects.toThrow("interrupted")
    await expect(
      processConversationIngress({ db: {} as never, sources: [source], ingest }),
    ).resolves.toEqual({ fetched: 1, committed: 0, duplicates: 1, acknowledged: 1 })
    expect(ingest).toHaveBeenCalledTimes(2)
    expect(ack).toHaveBeenCalledTimes(2)
  })

  it("validates a fetched envelope before commit or acknowledgement", async () => {
    const source = {
      id: "source",
      list: vi.fn(async () => ({ items: [{ id: "invalid" }] })),
      fetch: vi.fn(async () => ({ ...envelope, sender: { address: "not-an-email" } }) as never),
      ack: vi.fn(async () => undefined),
    }
    const ingest = vi.fn()
    await expect(
      processConversationIngress({ db: {} as never, sources: [source], ingest }),
    ).rejects.toThrow()
    expect(ingest).not.toHaveBeenCalled()
    expect(source.ack).not.toHaveBeenCalled()
  })

  it("rejects an envelope claimed by a different ingress source", async () => {
    const source = {
      id: "different-source",
      list: vi.fn(async () => ({ items: [{ id: "env-1" }] })),
      fetch: vi.fn(async () => envelope),
      ack: vi.fn(async () => undefined),
    }
    const ingest = vi.fn()
    await expect(
      processConversationIngress({ db: {} as never, sources: [source], ingest }),
    ).rejects.toThrow("does not match")
    expect(ingest).not.toHaveBeenCalled()
    expect(source.ack).not.toHaveBeenCalled()
  })
})
