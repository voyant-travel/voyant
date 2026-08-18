import { describe, expect, it } from "vitest"
import { adminInvalidationKeys } from "./admin.js"

describe("conversation query invalidation", () => {
  it("invalidates the Conversations React Query root", () => {
    expect(
      adminInvalidationKeys({ event: "conversation.changed", entity: "conversation" }),
    ).toEqual([["voyant", "conversations"]])
  })
})
