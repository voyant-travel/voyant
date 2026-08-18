import { describe, expect, it } from "vitest"
import {
  realtimeConversationChangedInvalidationSubscriber,
  realtimeInvalidationRoutes,
} from "./runtime.js"

describe("conversation invalidation", () => {
  it("keeps the runtime subscription aligned with the package-owned event name", () => {
    expect(realtimeConversationChangedInvalidationSubscriber.eventType).toBe("conversation.changed")
    expect(
      realtimeInvalidationRoutes["conversation.changed"]({ conversationId: "conv_1" }),
    ).toEqual({
      channels: ["admin"],
      hint: { entity: "conversation", id: "conv_1" },
    })
  })
})
