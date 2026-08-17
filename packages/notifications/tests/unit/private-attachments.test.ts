import { describe, expect, it, vi } from "vitest"
import { materializeNotificationPrivateAttachments } from "../../src/service-durable-send.js"

describe("durable private attachment materialization", () => {
  it("fails closed without a resolver and never forwards a stable handle", async () => {
    const payload = {
      to: "customer@example.test",
      channel: "email",
      template: "direct",
      attachments: [{ filename: "invoice.pdf", privateHandle: "stable-handle" }],
    }
    await expect(
      materializeNotificationPrivateAttachments(payload, undefined, { targetId: "part-one" }),
    ).rejects.toThrow("resolver is not configured")
    const resolveForDelivery = vi.fn(async () => ({
      filename: "invoice.pdf",
      contentType: "application/pdf",
      disposition: "attachment" as const,
      path: "https://private.invalid/attempt",
    }))
    const first = await materializeNotificationPrivateAttachments(
      payload,
      { resolveForDelivery },
      { targetId: "part-one" },
    )
    const second = await materializeNotificationPrivateAttachments(
      payload,
      { resolveForDelivery },
      { targetId: "part-one" },
    )
    expect(resolveForDelivery).toHaveBeenCalledTimes(2)
    expect(resolveForDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ targetId: "part-one", privateHandle: "stable-handle" }),
    )
    expect(first.attachments?.[0]).not.toHaveProperty("privateHandle")
    expect(second.attachments?.[0]).not.toHaveProperty("privateHandle")
  })
})
