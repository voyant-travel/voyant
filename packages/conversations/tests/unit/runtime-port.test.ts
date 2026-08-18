import { describe, expect, it } from "vitest"
import {
  conversationsPersonDirectoryPort,
  conversationsRenderedMessageAdmissionPort,
} from "../../src/runtime-port.js"

describe("Conversations-owned consumer ports", () => {
  it("keeps People resolution read-only", () => {
    const provider = {
      resolveEmail: async () => ({ kind: "none" as const }),
      resolvePhone: async () => ({ kind: "none" as const }),
      resolvePersonContactPoint: async () => null,
    }
    expect(() => conversationsPersonDirectoryPort.test?.(provider)).not.toThrow()
    expect(provider).not.toHaveProperty("create")
    expect(provider).not.toHaveProperty("merge")
  })

  it("requires transactional rendered-message admission", () => {
    expect(() =>
      conversationsRenderedMessageAdmissionPort.test?.({
        admitRenderedServiceMessage: async () => ({
          deliveryId: "delivery_1",
          state: "pending" as const,
        }),
      }),
    ).not.toThrow()
    expect(() => conversationsRenderedMessageAdmissionPort.test?.({} as never)).toThrow(
      "admitRenderedServiceMessage",
    )
  })
})
