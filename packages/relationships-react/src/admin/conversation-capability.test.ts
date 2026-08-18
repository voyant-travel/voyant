import { describe, expect, it } from "vitest"
import { canStartPersonConversation } from "./conversation-capability.js"

const allowed = {
  modules: ["@voyant-travel/conversations"],
  operations: [
    {
      method: "POST",
      pathTemplate: "/v1/admin/conversations",
      scopes: ["conversations:write"],
    },
  ],
  scopes: ["conversations:write"],
}

describe("Person conversation capability", () => {
  it("fails closed while discovery is unknown or write permission is denied", () => {
    expect(canStartPersonConversation(undefined)).toBe(false)
    expect(canStartPersonConversation({ ...allowed, scopes: ["conversations:read"] })).toBe(false)
    expect(canStartPersonConversation({ ...allowed, operations: [] })).toBe(false)
    expect(canStartPersonConversation({ ...allowed, modules: [] })).toBe(false)
  })

  it("requires the selected module and exact write operation", () => {
    expect(canStartPersonConversation(allowed)).toBe(true)
  })
})
