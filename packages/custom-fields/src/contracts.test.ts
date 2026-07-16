import { describe, expect, it } from "vitest"
import { customFieldDefinitionInputSchema, updateCustomFieldDefinitionSchema } from "./contracts.js"

describe("custom-field definition contracts", () => {
  it("defaults visibility and admits graph-validated target ids", () => {
    expect(
      customFieldDefinitionInputSchema.parse({
        entityType: "booking",
        key: "group_size",
        label: "Group size",
        fieldType: "double",
      }),
    ).toMatchObject({
      entityType: "booking",
      isRequired: false,
      isSearchable: false,
      isExportable: true,
      isInvoiceable: false,
    })
  })

  it("keeps target, type, and key immutable after creation", () => {
    expect(updateCustomFieldDefinitionSchema.parse({ label: "Updated" })).toEqual({
      label: "Updated",
    })
    expect(() => updateCustomFieldDefinitionSchema.parse({ key: "renamed" })).toThrow()
  })
})
