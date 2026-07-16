import { describe, expect, it } from "vitest"
import { upsertCustomFieldValueSchema } from "./value-contracts.js"

describe("custom-field value contracts", () => {
  it("requires entity type and entity id", () => {
    const value = upsertCustomFieldValueSchema.parse({
      entityType: "organization",
      entityId: "crm_org_abc",
      textValue: "hello",
    })
    expect(value.entityType).toBe("organization")
    expect(value.entityId).toBe("crm_org_abc")
  })

  it("rejects incomplete value targets", () => {
    expect(() => upsertCustomFieldValueSchema.parse({ entityId: "crm_org_abc" })).toThrow()
    expect(() => upsertCustomFieldValueSchema.parse({ entityType: "organization" })).toThrow()
  })
})
