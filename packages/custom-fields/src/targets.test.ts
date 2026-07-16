import { describe, expect, it } from "vitest"
import { createCustomFieldTargetRegistry } from "./targets.js"

describe("selected custom-field target registry", () => {
  it("is immutable, de-duplicates types, and rejects duplicate target ownership", () => {
    const registry = createCustomFieldTargetRegistry([
      {
        id: "booking",
        label: "Booking",
        fieldTypes: ["text", "text", "boolean"],
        capabilities: ["read", "write"],
        ownerUnitId: "@voyant-travel/bookings",
      },
    ])
    expect(registry.get("booking")?.fieldTypes).toEqual(["boolean", "text"])
    expect(() =>
      createCustomFieldTargetRegistry([
        {
          id: "booking",
          label: "Booking",
          fieldTypes: ["text"],
          capabilities: ["read"],
          ownerUnitId: "@voyant-travel/bookings",
        },
        {
          id: "booking",
          label: "Another booking",
          fieldTypes: ["text"],
          capabilities: ["read"],
          ownerUnitId: "@voyant-travel/orders",
        },
      ]),
    ).toThrow(/duplicate custom-field target/)
  })
})
