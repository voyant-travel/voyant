import { describe, expect, it } from "vitest"

import {
  type CustomFieldDefinition,
  createCustomFieldRegistry,
  customFieldsFromGlob,
  customFieldsVisibleIn,
  defineCustomField,
  mergeCustomFieldDefinitions,
  validateCustomFields,
} from "../../src/custom-fields.js"

const fields: CustomFieldDefinition[] = [
  defineCustomField({
    entity: "booking",
    namespace: "custom",
    key: "tour_guide",
    type: "text",
    label: "Tour guide",
  }),
  defineCustomField({
    entity: "booking",
    namespace: "custom",
    key: "group_size",
    type: "number",
    label: "Group size",
    required: true,
  }),
  defineCustomField({
    entity: "booking",
    namespace: "custom",
    key: "meal_plan",
    type: "select",
    label: "Meal plan",
    options: ["none", "half-board", "full-board"],
    visibility: { invoice: true },
  }),
  defineCustomField({
    entity: "person",
    namespace: "custom",
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
    expect(registry.field("person", "custom", "passport")?.pii).toBe(true)
    expect(registry.entities().sort()).toEqual(["booking", "person"])
  })

  it("rejects a duplicate (entity, namespace, key)", () => {
    expect(() =>
      createCustomFieldRegistry([
        { entity: "booking", namespace: "custom", key: "x", type: "text", label: "X" },
        { entity: "booking", namespace: "custom", key: "x", type: "number", label: "X2" },
      ]),
    ).toThrow(/duplicate custom field "booking\.custom\.x"/)
  })
})

describe("validateCustomFields", () => {
  it("accepts valid input and drops nothing required", () => {
    const r = validateCustomFields(registry, "booking", {
      custom: { tour_guide: "Ana", group_size: 4, meal_plan: "half-board" },
    })
    expect(r.ok).toBe(true)
    expect(r.value).toEqual({
      custom: { tour_guide: "Ana", group_size: 4, meal_plan: "half-board" },
    })
  })

  it("errors on a missing required field", () => {
    const r = validateCustomFields(registry, "booking", { custom: { tour_guide: "Ana" } })
    expect(r.ok).toBe(false)
    expect(r.errors).toContainEqual({
      namespace: "custom",
      key: "group_size",
      message: "is required",
    })
  })

  it("errors on wrong type and bad select option", () => {
    const r = validateCustomFields(registry, "booking", {
      custom: { group_size: "four", meal_plan: "brunch" },
    })
    expect(r.ok).toBe(false)
    expect(r.errors.map((e) => e.key).sort()).toEqual(["group_size", "meal_plan"])
  })

  it("rejects unknown keys (typo-proofing)", () => {
    const r = validateCustomFields(registry, "booking", {
      custom: { group_size: 2, tourguide: "typo" },
    })
    expect(r.ok).toBe(false)
    expect(r.errors).toContainEqual({
      namespace: "custom",
      key: "tourguide",
      message: 'unknown custom field for "booking"',
    })
  })

  it("runs a custom validate rule", () => {
    const reg = createCustomFieldRegistry([
      {
        entity: "booking",
        namespace: "custom",
        key: "code",
        type: "text",
        label: "Code",
        validate: (v) => (String(v).length === 3 ? null : "must be 3 chars"),
      },
    ])
    expect(validateCustomFields(reg, "booking", { custom: { code: "ABC" } }).ok).toBe(true)
    expect(
      validateCustomFields(reg, "booking", { custom: { code: "AB" } }).errors[0]?.message,
    ).toBe("must be 3 chars")
  })

  it("accepts ISO date strings and Date instances", () => {
    const reg = createCustomFieldRegistry([
      { entity: "booking", namespace: "custom", key: "when", type: "date", label: "When" },
    ])
    expect(validateCustomFields(reg, "booking", { custom: { when: "2026-06-17" } }).ok).toBe(true)
    expect(validateCustomFields(reg, "booking", { custom: { when: "not-a-date" } }).ok).toBe(false)
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
    const a = defineCustomField({
      entity: "booking",
      namespace: "custom",
      key: "a",
      type: "text",
      label: "A",
    })
    const b = defineCustomField({
      entity: "person",
      namespace: "custom",
      key: "b",
      type: "text",
      label: "B",
    })
    const c = defineCustomField({
      entity: "product",
      namespace: "custom",
      key: "c",
      type: "text",
      label: "C",
    })
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

describe("validateCustomFields — superset types", () => {
  const reg = createCustomFieldRegistry([
    {
      entity: "e",
      namespace: "custom",
      key: "tags",
      type: "multiselect",
      label: "Tags",
      options: ["a", "b", "c"],
    },
    { entity: "e", namespace: "custom", key: "price", type: "monetary", label: "Price" },
    { entity: "e", namespace: "custom", key: "meta", type: "json", label: "Meta" },
  ])

  it("multiselect accepts a subset of options, rejects an unknown member", () => {
    expect(validateCustomFields(reg, "e", { custom: { tags: ["a", "c"] } }).ok).toBe(true)
    expect(validateCustomFields(reg, "e", { custom: { tags: ["a", "z"] } }).ok).toBe(false)
    expect(validateCustomFields(reg, "e", { custom: { tags: "a" } }).ok).toBe(false)
  })

  it("monetary requires { amountCents:int, currency:3-letter }", () => {
    expect(
      validateCustomFields(reg, "e", { custom: { price: { amountCents: 1500, currency: "EUR" } } })
        .ok,
    ).toBe(true)
    expect(
      validateCustomFields(reg, "e", { custom: { price: { amountCents: 1.5, currency: "EUR" } } })
        .ok,
    ).toBe(false)
    expect(
      validateCustomFields(reg, "e", { custom: { price: { amountCents: 10, currency: "EURO" } } })
        .ok,
    ).toBe(false)
  })

  it("json accepts arbitrary objects/arrays", () => {
    expect(validateCustomFields(reg, "e", { custom: { meta: { a: 1, b: [2] } } }).ok).toBe(true)
    expect(validateCustomFields(reg, "e", { custom: { meta: [1, 2, 3] } }).ok).toBe(true)
  })
})

describe("mergeCustomFieldDefinitions", () => {
  const code: CustomFieldDefinition[] = [
    {
      entity: "person",
      namespace: "custom",
      key: "tier",
      type: "select",
      label: "Tier (code)",
      options: ["gold"],
    },
  ]
  const db: CustomFieldDefinition[] = [
    { entity: "person", namespace: "custom", key: "tier", type: "text", label: "Tier (db)" },
    { entity: "person", namespace: "custom", key: "nickname", type: "text", label: "Nickname" },
  ]

  it("dedupes by (entity,key) with the earlier source winning", () => {
    const shadows: string[] = []
    const merged = mergeCustomFieldDefinitions([code, db], (s) => shadows.push(s.label))
    const tier = merged.find((d) => d.key === "tier")
    expect(tier?.label).toBe("Tier (code)") // code wins
    expect(merged.map((d) => d.key).sort()).toEqual(["nickname", "tier"])
    expect(shadows).toEqual(["Tier (db)"]) // db tier shadowed
  })

  it("produces a list a registry accepts (no duplicate throw)", () => {
    expect(() => createCustomFieldRegistry(mergeCustomFieldDefinitions([code, db]))).not.toThrow()
  })
})
