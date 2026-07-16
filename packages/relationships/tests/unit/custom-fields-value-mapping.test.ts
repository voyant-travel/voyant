import { describe, expect, it } from "vitest"

import {
  entityTableName,
  jsonbValueFromTyped,
  parseSyntheticValueId,
  syntheticValueId,
  type TypedValueColumns,
  typedFromJsonbValue,
} from "../../src/service/custom-fields-value-mapping.js"

describe("entityTableName", () => {
  it("maps the four EAV entity types to their tables", () => {
    expect(entityTableName("person")).toBe("people")
    expect(entityTableName("organization")).toBe("organizations")
    expect(entityTableName("activity")).toBe("activities")
    expect(entityTableName("quote")).toBe("quotes")
    expect(entityTableName("unknown")).toBeNull()
  })
})

describe("synthetic value id", () => {
  it("round-trips entityType/entityId/namespace/definitionId", () => {
    const id = syntheticValueId("person", "pers_1", "custom", "cfd_2")
    expect(parseSyntheticValueId(id)).toEqual({
      entityType: "person",
      entityId: "pers_1",
      namespace: "custom",
      definitionId: "cfd_2",
    })
  })
  it("rejects malformed ids", () => {
    expect(parseSyntheticValueId("not-an-id")).toBeNull()
    expect(parseSyntheticValueId("a::b")).toBeNull()
    expect(parseSyntheticValueId("a::::c")).toBeNull()
  })
})

describe("typed ↔ jsonb value mapping round-trips per field type", () => {
  const cases: Array<{ fieldType: string; input: Partial<TypedValueColumns>; jsonb: unknown }> = [
    { fieldType: "text", input: { textValue: "hi" }, jsonb: "hi" },
    { fieldType: "varchar", input: { textValue: "v" }, jsonb: "v" },
    { fieldType: "enum", input: { textValue: "gold" }, jsonb: "gold" },
    { fieldType: "phone", input: { textValue: "+40123" }, jsonb: "+40123" },
    { fieldType: "double", input: { numberValue: 42 }, jsonb: 42 },
    { fieldType: "date", input: { dateValue: "2026-06-17" }, jsonb: "2026-06-17" },
    { fieldType: "boolean", input: { booleanValue: true }, jsonb: true },
    {
      fieldType: "monetary",
      input: { monetaryValueCents: 1500, currencyCode: "EUR" },
      jsonb: { amountCents: 1500, currency: "EUR" },
    },
    { fieldType: "set", input: { jsonValue: ["a", "b"] }, jsonb: ["a", "b"] },
    { fieldType: "json", input: { jsonValue: { k: 1 } }, jsonb: { k: 1 } },
    { fieldType: "address", input: { jsonValue: { city: "Cluj" } }, jsonb: { city: "Cluj" } },
  ]

  for (const { fieldType, input, jsonb } of cases) {
    it(`${fieldType}`, () => {
      // typed input → jsonb
      expect(jsonbValueFromTyped(fieldType, input)).toEqual(jsonb)
      // jsonb → typed → jsonb (stable)
      const typed = typedFromJsonbValue(fieldType, jsonb)
      expect(jsonbValueFromTyped(fieldType, typed)).toEqual(jsonb)
    })
  }
})
