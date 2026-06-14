import { describe, expect, it } from "vitest"

import { counterpartyEntityTypeToRole, counterpartyRoleToEntityType } from "../../src/index.js"

describe("Distribution counterparty vocabulary", () => {
  it("keeps Supplier and Channel as distinct entity roles", () => {
    expect(counterpartyRoleToEntityType("supplier")).toBe("supplier")
    expect(counterpartyRoleToEntityType("channel")).toBe("channel")
  })

  it("rejects entity types outside the Distribution counterparty seam", () => {
    expect(counterpartyEntityTypeToRole("supplier")).toBe("supplier")
    expect(counterpartyEntityTypeToRole("channel")).toBe("channel")
    expect(counterpartyEntityTypeToRole("organization")).toBeNull()
  })
})
