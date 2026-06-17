import { describe, expect, it } from "vitest"

import {
  type CustomFieldDefinition,
  createCustomFieldRegistry,
  customFieldsFromGlob,
  customFieldsVisibleIn,
  defineCustomField,
  validateCustomFields,
} from "../../src/custom-fields.js"

const fields: CustomFieldDefinition[] = [
  defineCustomField({ entity: "booking", key: "tour_guide", type: "text", label: "Tour guide" }),
  defineCustomField({
    entity: "booking",
    key: "group_size",
    type: "number",
    label: "Group size",
    required: true,
  }),
  defineCustomField({
    entity: "booking",
    key: "meal_plan",
    type: "select",
    label: "Meal plan",
    options: ["none", "half-board", "full-board"],
    visibility: { invoice: true },
  }),
  defineCustomField({
    entity: "person",
    key: "passport",
    type: "text",
    label: "Passport",
    pii: true,
    visibility: { export: false },
  }),
]
const registry = createCustomFieldRegistry(fields)

describe("createCustomFieldRegistry", () => {
  it("indexes by entity and key", () => {
    expect(registry.forEntity("booking").map((f) => f.key)).toEqual([
      "tour_guide",
      "group_size",
      "meal_plan",
    ])
    expect(registry.field("person", "passport")?.pii).toBe(true)
    expect(registry.entities().sort()).toEqual(["booking", "person"])
  })

  it("rejects a duplicate (entity, key)", () => {
    expect(() =>
      createCustomFieldRegistry([
        { entity: "booking", key: "x", type: "text", label: "X" },
        { entity: "booking", key: "x", type: "number", label: "X2" },
      ]),
    ).toThrow(/duplicate custom field "booking\.x"/)
  })
})

describe("validateCustomFields", () => {
  it("accepts valid input and drops nothing required", () => {
    const r = validateCustomFields(registry, "booking", {
      tour_guide: "Ana",
      group_size: 4,
      meal_plan: "half-board",
    })
    expect(r.ok).toBe(true)
    expect(r.value).toEqual({ tour_guide: "Ana", group_size: 4, meal_plan: "half-board" })
  })

  it("errors on a missing required field", () => {
    const r = validateCustomFields(registry, "booking", { tour_guide: "Ana" })
    expect(r.ok).toBe(false)
    expect(r.errors).toContainEqual({ key: "group_size", message: "is required" })
  })

  it("errors on wrong type and bad select option", () => {
    const r = validateCustomFields(registry, "booking", {
      group_size: "four",
      meal_plan: "brunch",
    })
    expect(r.ok).toBe(false)
    expect(r.errors.map((e) => e.key).sort()).toEqual(["group_size", "meal_plan"])
  })

  it("rejects unknown keys (typo-proofing)", () => {
    const r = validateCustomFields(registry, "booking", { group_size: 2, tourguide: "typo" })
    expect(r.ok).toBe(false)
    expect(r.errors).toContainEqual({
      key: "tourguide",
      message: 'unknown custom field for "booking"',
    })
  })

  it("runs a custom validate rule", () => {
    const reg = createCustomFieldRegistry([
      {
        entity: "booking",
        key: "code",
        type: "text",
        label: "Code",
        validate: (v) => (String(v).length === 3 ? null : "must be 3 chars"),
      },
    ])
    expect(validateCustomFields(reg, "booking", { code: "ABC" }).ok).toBe(true)
    expect(validateCustomFields(reg, "booking", { code: "AB" }).errors[0]?.message).toBe(
      "must be 3 chars",
    )
  })

  it("accepts ISO date strings and Date instances", () => {
    const reg = createCustomFieldRegistry([
      { entity: "booking", key: "when", type: "date", label: "When" },
    ])
    expect(validateCustomFields(reg, "booking", { when: "2026-06-17" }).ok).toBe(true)
    expect(validateCustomFields(reg, "booking", { when: "not-a-date" }).ok).toBe(false)
  })
})

describe("customFieldsVisibleIn", () => {
  it("applies per-channel defaults (export on, invoice/search off)", () => {
    expect(customFieldsVisibleIn(registry, "booking", "export").map((f) => f.key)).toEqual([
      "tour_guide",
      "group_size",
      "meal_plan",
    ])
    expect(customFieldsVisibleIn(registry, "booking", "invoice").map((f) => f.key)).toEqual([
      "meal_plan",
    ])
    expect(customFieldsVisibleIn(registry, "booking", "search")).toEqual([])
  })

  it("honors explicit export:false", () => {
    expect(customFieldsVisibleIn(registry, "person", "export")).toEqual([])
  })
})

describe("customFieldsFromGlob", () => {
  it("flattens single + array default exports in path order", () => {
    const a = defineCustomField({ entity: "booking", key: "a", type: "text", label: "A" })
    const b = defineCustomField({ entity: "person", key: "b", type: "text", label: "B" })
    const c = defineCustomField({ entity: "product", key: "c", type: "text", label: "C" })
    const found = customFieldsFromGlob({
      "../custom-fields/person.ts": { default: b },
      "../custom-fields/booking.ts": { default: [a, c] },
    })
    // path-sorted: booking.ts (array) before person.ts
    expect(found.map((f) => f.key)).toEqual(["a", "c", "b"])
  })

  it("returns empty for an empty glob", () => {
    expect(customFieldsFromGlob({})).toEqual([])
  })

  it("throws on a matched file with no default export", () => {
    expect(() => customFieldsFromGlob({ "../custom-fields/x.ts": { named: 1 } })).toThrow(
      /no default export/,
    )
  })
})
