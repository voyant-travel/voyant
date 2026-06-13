import { describe, expect, it } from "vitest"

import {
  bookingAnswerTargetSchema,
  bookingQuestionFieldTypeSchema,
  bookingQuestionTargetSchema,
  bookingQuestionTriggerModeSchema,
  contactRequirementFieldSchema,
  contactRequirementScopeSchema,
  insertBookingAnswerSchema,
  insertBookingQuestionExtraTriggerSchema,
  insertBookingQuestionOptionSchema,
  insertBookingQuestionOptionTriggerSchema,
  insertBookingQuestionUnitTriggerSchema,
  insertOptionBookingQuestionSchema,
  insertProductBookingQuestionSchema,
  insertProductContactRequirementSchema,
  productBookingQuestionListQuerySchema,
  productContactRequirementListQuerySchema,
  updateProductContactRequirementSchema,
} from "../../../src/requirements/validation.js"

describe("Enum schemas", () => {
  it("accepts valid contact requirement fields", () => {
    for (const f of [
      "first_name",
      "last_name",
      "email",
      "phone",
      "date_of_birth",
      "nationality",
      "passport_number",
      "passport_expiry",
      "dietary_requirements",
      "accessibility_needs",
      "special_requests",
      "address",
      "other",
    ]) {
      expect(contactRequirementFieldSchema.parse(f)).toBe(f)
    }
  })

  it("rejects invalid contact requirement field", () => {
    expect(() => contactRequirementFieldSchema.parse("invalid")).toThrow()
  })

  it("accepts valid contact requirement scopes", () => {
    for (const s of ["booking", "lead_traveler", "traveler", "booker"]) {
      expect(contactRequirementScopeSchema.parse(s)).toBe(s)
    }
  })

  it("rejects invalid contact requirement scope", () => {
    expect(() => contactRequirementScopeSchema.parse("admin")).toThrow()
  })

  it("accepts valid booking question targets", () => {
    for (const t of ["booking", "traveler", "lead_traveler", "booker", "extra", "service"]) {
      expect(bookingQuestionTargetSchema.parse(t)).toBe(t)
    }
  })

  it("accepts valid booking question field types", () => {
    for (const f of [
      "text",
      "textarea",
      "number",
      "email",
      "phone",
      "date",
      "datetime",
      "boolean",
      "single_select",
      "multi_select",
      "file",
      "country",
      "other",
    ]) {
      expect(bookingQuestionFieldTypeSchema.parse(f)).toBe(f)
    }
  })

  it("rejects invalid field type", () => {
    expect(() => bookingQuestionFieldTypeSchema.parse("radio")).toThrow()
  })

  it("accepts valid trigger modes", () => {
    for (const m of ["required", "optional", "hidden"]) {
      expect(bookingQuestionTriggerModeSchema.parse(m)).toBe(m)
    }
  })

  it("accepts valid booking answer targets", () => {
    for (const t of ["booking", "traveler", "extra"]) {
      expect(bookingAnswerTargetSchema.parse(t)).toBe(t)
    }
  })

  it("rejects invalid answer target", () => {
    expect(() => bookingAnswerTargetSchema.parse("lead_traveler")).toThrow()
  })
})

describe("Product contact requirement schema", () => {
  const valid = { productId: "prod_abc", fieldKey: "email" }

  it("accepts valid input with defaults", () => {
    const result = insertProductContactRequirementSchema.parse(valid)
    expect(result.productId).toBe("prod_abc")
    expect(result.fieldKey).toBe("email")
    expect(result.scope).toBe("traveler")
    expect(result.isRequired).toBe(false)
    expect(result.perTraveler).toBe(false)
    expect(result.active).toBe(true)
    expect(result.sortOrder).toBe(0)
  })

  it("rejects missing productId", () => {
    expect(() => insertProductContactRequirementSchema.parse({ fieldKey: "email" })).toThrow()
  })

  it("rejects invalid fieldKey", () => {
    expect(() =>
      insertProductContactRequirementSchema.parse({ ...valid, fieldKey: "invalid" }),
    ).toThrow()
  })

  it("rejects invalid scope", () => {
    expect(() =>
      insertProductContactRequirementSchema.parse({ ...valid, scope: "admin" }),
    ).toThrow()
  })

  it("accepts optional nullable fields", () => {
    const result = insertProductContactRequirementSchema.parse({
      ...valid,
      optionId: null,
      notes: "Some note",
    })
    expect(result.optionId).toBeNull()
    expect(result.notes).toBe("Some note")
  })
})

describe("Update product contact requirement schema", () => {
  it("accepts partial update", () => {
    const result = updateProductContactRequirementSchema.parse({ isRequired: true })
    expect(result.isRequired).toBe(true)
    expect(result.productId).toBeUndefined()
  })

  it("accepts empty object", () => {
    const result = updateProductContactRequirementSchema.parse({})
    expect(result).toBeDefined()
  })
})

describe("Product booking question schema", () => {
  const valid = { productId: "prod_abc", label: "Dietary needs?" }

  it("accepts valid input with defaults", () => {
    const result = insertProductBookingQuestionSchema.parse(valid)
    expect(result.productId).toBe("prod_abc")
    expect(result.label).toBe("Dietary needs?")
    expect(result.target).toBe("booking")
    expect(result.fieldType).toBe("text")
    expect(result.isRequired).toBe(false)
    expect(result.active).toBe(true)
    expect(result.sortOrder).toBe(0)
  })

  it("rejects missing label", () => {
    expect(() => insertProductBookingQuestionSchema.parse({ productId: "prod_abc" })).toThrow()
  })

  it("rejects empty label", () => {
    expect(() => insertProductBookingQuestionSchema.parse({ ...valid, label: "" })).toThrow()
  })

  it("rejects label over 255 chars", () => {
    expect(() =>
      insertProductBookingQuestionSchema.parse({ ...valid, label: "x".repeat(256) }),
    ).toThrow()
  })

  it("accepts valid target and fieldType overrides", () => {
    const result = insertProductBookingQuestionSchema.parse({
      ...valid,
      target: "traveler",
      fieldType: "single_select",
    })
    expect(result.target).toBe("traveler")
    expect(result.fieldType).toBe("single_select")
  })

  it("accepts metadata object", () => {
    const result = insertProductBookingQuestionSchema.parse({
      ...valid,
      metadata: { key: "value" },
    })
    expect(result.metadata).toEqual({ key: "value" })
  })

  it("accepts nullable optional fields", () => {
    const result = insertProductBookingQuestionSchema.parse({
      ...valid,
      code: null,
      description: null,
      placeholder: null,
      helpText: null,
      metadata: null,
    })
    expect(result.code).toBeNull()
    expect(result.description).toBeNull()
  })
})

describe("Option booking question schema", () => {
  const valid = { optionId: "opt_abc", productBookingQuestionId: "pbqq_abc" }

  it("accepts valid input with defaults", () => {
    const result = insertOptionBookingQuestionSchema.parse(valid)
    expect(result.optionId).toBe("opt_abc")
    expect(result.productBookingQuestionId).toBe("pbqq_abc")
    expect(result.active).toBe(true)
    expect(result.sortOrder).toBe(0)
  })

  it("rejects missing optionId", () => {
    expect(() =>
      insertOptionBookingQuestionSchema.parse({ productBookingQuestionId: "pbqq_abc" }),
    ).toThrow()
  })

  it("rejects missing productBookingQuestionId", () => {
    expect(() => insertOptionBookingQuestionSchema.parse({ optionId: "opt_abc" })).toThrow()
  })

  it("accepts nullable isRequiredOverride", () => {
    const result = insertOptionBookingQuestionSchema.parse({
      ...valid,
      isRequiredOverride: null,
    })
    expect(result.isRequiredOverride).toBeNull()
  })
})

describe("Booking question option schema", () => {
  const valid = { productBookingQuestionId: "pbqq_abc", value: "vegan", label: "Vegan" }

  it("accepts valid input with defaults", () => {
    const result = insertBookingQuestionOptionSchema.parse(valid)
    expect(result.value).toBe("vegan")
    expect(result.label).toBe("Vegan")
    expect(result.sortOrder).toBe(0)
    expect(result.isDefault).toBe(false)
    expect(result.active).toBe(true)
  })

  it("rejects empty value", () => {
    expect(() => insertBookingQuestionOptionSchema.parse({ ...valid, value: "" })).toThrow()
  })

  it("rejects empty label", () => {
    expect(() => insertBookingQuestionOptionSchema.parse({ ...valid, label: "" })).toThrow()
  })

  it("rejects value over 255 chars", () => {
    expect(() =>
      insertBookingQuestionOptionSchema.parse({ ...valid, value: "x".repeat(256) }),
    ).toThrow()
  })

  it("rejects missing productBookingQuestionId", () => {
    expect(() => insertBookingQuestionOptionSchema.parse({ value: "v", label: "L" })).toThrow()
  })
})

describe("Booking question unit trigger schema", () => {
  const valid = { productBookingQuestionId: "pbqq_abc", unitId: "unit_abc" }

  it("accepts valid input with defaults", () => {
    const result = insertBookingQuestionUnitTriggerSchema.parse(valid)
    expect(result.triggerMode).toBe("required")
    expect(result.active).toBe(true)
  })

  it("accepts optional triggerMode override", () => {
    const result = insertBookingQuestionUnitTriggerSchema.parse({
      ...valid,
      triggerMode: "optional",
    })
    expect(result.triggerMode).toBe("optional")
  })

  it("accepts nullable minQuantity", () => {
    const result = insertBookingQuestionUnitTriggerSchema.parse({
      ...valid,
      minQuantity: null,
    })
    expect(result.minQuantity).toBeNull()
  })

  it("rejects negative minQuantity", () => {
    expect(() =>
      insertBookingQuestionUnitTriggerSchema.parse({ ...valid, minQuantity: -1 }),
    ).toThrow()
  })
})

describe("Booking question option trigger schema", () => {
  const valid = { productBookingQuestionId: "pbqq_abc", optionId: "opt_abc" }

  it("accepts valid input with defaults", () => {
    const result = insertBookingQuestionOptionTriggerSchema.parse(valid)
    expect(result.triggerMode).toBe("required")
    expect(result.active).toBe(true)
  })

  it("rejects missing productBookingQuestionId", () => {
    expect(() => insertBookingQuestionOptionTriggerSchema.parse({ optionId: "opt_abc" })).toThrow()
  })
})

describe("Booking question extra trigger schema", () => {
  const valid = { productBookingQuestionId: "pbqq_abc" }

  it("accepts valid input with defaults", () => {
    const result = insertBookingQuestionExtraTriggerSchema.parse(valid)
    expect(result.triggerMode).toBe("required")
    expect(result.active).toBe(true)
  })

  it("accepts nullable FK fields", () => {
    const result = insertBookingQuestionExtraTriggerSchema.parse({
      ...valid,
      productExtraId: null,
      optionExtraConfigId: null,
    })
    expect(result.productExtraId).toBeNull()
    expect(result.optionExtraConfigId).toBeNull()
  })

  it("accepts optional minQuantity", () => {
    const result = insertBookingQuestionExtraTriggerSchema.parse({
      ...valid,
      minQuantity: 5,
    })
    expect(result.minQuantity).toBe(5)
  })
})

describe("Booking answer schema", () => {
  const valid = { bookingId: "book_abc", productBookingQuestionId: "pbqq_abc" }

  it("accepts valid input with defaults", () => {
    const result = insertBookingAnswerSchema.parse(valid)
    expect(result.bookingId).toBe("book_abc")
    expect(result.target).toBe("booking")
  })

  it("rejects missing bookingId", () => {
    expect(() =>
      insertBookingAnswerSchema.parse({ productBookingQuestionId: "pbqq_abc" }),
    ).toThrow()
  })

  it("rejects missing productBookingQuestionId", () => {
    expect(() => insertBookingAnswerSchema.parse({ bookingId: "book_abc" })).toThrow()
  })

  it("accepts value fields", () => {
    const result = insertBookingAnswerSchema.parse({
      ...valid,
      valueText: "Gluten-free",
      valueNumber: 42,
      valueBoolean: true,
    })
    expect(result.valueText).toBe("Gluten-free")
    expect(result.valueNumber).toBe(42)
    expect(result.valueBoolean).toBe(true)
  })

  it("accepts valueJson as record", () => {
    const result = insertBookingAnswerSchema.parse({
      ...valid,
      valueJson: { key: "value" },
    })
    expect(result.valueJson).toEqual({ key: "value" })
  })

  it("accepts valueJson as string array", () => {
    const result = insertBookingAnswerSchema.parse({
      ...valid,
      valueJson: ["a", "b"],
    })
    expect(result.valueJson).toEqual(["a", "b"])
  })

  it("accepts nullable optional FK fields", () => {
    const result = insertBookingAnswerSchema.parse({
      ...valid,
      bookingTravelerId: null,
      bookingExtraId: null,
    })
    expect(result.bookingTravelerId).toBeNull()
    expect(result.bookingExtraId).toBeNull()
  })
})

describe("Pagination and list query schemas", () => {
  it("applies default limit and offset for contact requirements", () => {
    const result = productContactRequirementListQuerySchema.parse({})
    expect(result.limit).toBe(50)
    expect(result.offset).toBe(0)
  })

  it("coerces string values", () => {
    const result = productContactRequirementListQuerySchema.parse({
      limit: "25",
      offset: "10",
    })
    expect(result.limit).toBe(25)
    expect(result.offset).toBe(10)
  })

  it("coerces active boolean from string", () => {
    const result = productContactRequirementListQuerySchema.parse({ active: "true" })
    expect(result.active).toBe(true)
  })

  it("rejects limit over 200", () => {
    expect(() => productContactRequirementListQuerySchema.parse({ limit: 201 })).toThrow()
  })

  it("rejects negative offset", () => {
    expect(() => productContactRequirementListQuerySchema.parse({ offset: -1 })).toThrow()
  })

  it("passes through optional filters for booking questions", () => {
    const result = productBookingQuestionListQuerySchema.parse({
      productId: "prod_abc",
      target: "booking",
      fieldType: "text",
    })
    expect(result.productId).toBe("prod_abc")
    expect(result.target).toBe("booking")
    expect(result.fieldType).toBe("text")
  })
})
