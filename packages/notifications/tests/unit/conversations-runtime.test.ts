import { describe, expect, it, vi } from "vitest"

import { createConversationsRenderedMessageAdmission } from "../../src/conversations-runtime.js"
import type { NotificationsRuntimeProvider } from "../../src/runtime-port.js"

describe("Conversations rendered-message admission", () => {
  it("exposes the exact Conversations consumer method", () => {
    const runtime = {
      resolveProviders: vi.fn(() => []),
    } as unknown as NotificationsRuntimeProvider
    const provider = createConversationsRenderedMessageAdmission(runtime)
    expect(typeof provider.admitRenderedServiceMessage).toBe("function")
  })
})
