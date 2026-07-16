import { describe, expect, it } from "vitest"
import {
  jsonbValueFromTypedCustomFieldValue,
  parseSyntheticCustomFieldValueId,
  syntheticCustomFieldValueId,
  type TypedCustomFieldValueColumns,
  typedCustomFieldValueFromJsonb,
} from "./value-mapping.js"

describe("synthetic custom-field value ids", () => {
  it("round-trips entity, namespace, and definition identity", () => {
    const id = syntheticCustomFieldValueId("person", "pers_1", "custom", "cfd_2")
    expect(parseSyntheticCustomFieldValueId(id)).toEqual({
      entityType: "person",
      entityId: "pers_1",
      namespace: "custom",
      definitionId: "cfd_2",
    })
  })

  it("rejects malformed ids", () => {
    expect(parseSyntheticCustomFieldValueId("not-an-id")).toBeNull()
    expect(parseSyntheticCustomFieldValueId("a::b")).toBeNull()
    expect(parseSyntheticCustomFieldValueId("a::::c")).toBeNull()
  })
})

describe("typed custom-field value conversion", () => {
  const cases: Array<{
    fieldType: string
    input: Partial<TypedCustomFieldValueColumns>
    jsonb: unknown
  }> = [
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
    it(`round-trips ${fieldType}`, () => {
      expect(jsonbValueFromTypedCustomFieldValue(fieldType, input)).toEqual(jsonb)
      expect(
        jsonbValueFromTypedCustomFieldValue(
          fieldType,
          typedCustomFieldValueFromJsonb(fieldType, jsonb),
        ),
      ).toEqual(jsonb)
    })
  }
})
