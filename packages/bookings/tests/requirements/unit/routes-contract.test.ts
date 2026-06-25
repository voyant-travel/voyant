import { listResponseSchema } from "@voyant-travel/types"
import { describe, expect, it } from "vitest"
import { z } from "zod"
import { __test__ } from "../../../src/requirements/routes.js"
import type {
  BookingAnswer,
  BookingQuestionExtraTrigger,
  BookingQuestionOption,
  BookingQuestionOptionTrigger,
  BookingQuestionUnitTrigger,
  OptionBookingQuestion,
  ProductBookingQuestion,
  ProductContactRequirement,
} from "../../../src/requirements/schema.js"

/**
 * Contract tests for the booking-requirements admin wire shapes (voyant#2114).
 * The handlers serialize Drizzle rows whose `timestamp` columns are `Date`s;
 * `c.json(...)` turns them into ISO strings on the wire. These tests assert the
 * authored OpenAPI response row schemas match the serialized wire form
 * (§17 Date→string) via a JSON round-trip, and that the canonical
 * `listResponseSchema(...)` envelope wraps them.
 */

const {
  productContactRequirementSchema,
  productBookingQuestionSchema,
  optionBookingQuestionSchema,
  bookingQuestionOptionSchema,
  bookingQuestionUnitTriggerSchema,
  bookingQuestionOptionTriggerSchema,
  bookingQuestionExtraTriggerSchema,
  bookingAnswerSchema,
} = __test__

/** Reproduce the wire form: JSON serialize then re-parse (Date → ISO string). */
function toWire<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value))
}

const createdAt = new Date("2026-05-15T10:00:00.000Z")
const updatedAt = new Date("2026-05-15T11:00:00.000Z")

const contactRequirement: ProductContactRequirement = {
  id: "pcr_1",
  productId: "prod_1",
  optionId: null,
  fieldKey: "passport_number",
  scope: "traveler",
  isRequired: true,
  perTraveler: true,
  active: true,
  sortOrder: 0,
  notes: null,
  createdAt,
  updatedAt,
}

const question: ProductBookingQuestion = {
  id: "pbq_1",
  productId: "prod_1",
  code: "diet",
  label: "Dietary requirements",
  description: null,
  target: "traveler",
  fieldType: "single_select",
  placeholder: null,
  helpText: null,
  isRequired: false,
  active: true,
  sortOrder: 1,
  metadata: { source: "intake" },
  createdAt,
  updatedAt,
}

const optionQuestion: OptionBookingQuestion = {
  id: "obq_1",
  optionId: "popt_1",
  productBookingQuestionId: "pbq_1",
  isRequiredOverride: true,
  active: true,
  sortOrder: 0,
  notes: null,
  createdAt,
  updatedAt,
}

const questionOption: BookingQuestionOption = {
  id: "bqo_1",
  productBookingQuestionId: "pbq_1",
  value: "vegan",
  label: "Vegan",
  sortOrder: 0,
  isDefault: false,
  active: true,
  createdAt,
  updatedAt,
}

const unitTrigger: BookingQuestionUnitTrigger = {
  id: "bqut_1",
  productBookingQuestionId: "pbq_1",
  unitId: "ou_1",
  triggerMode: "required",
  minQuantity: 1,
  active: true,
  createdAt,
  updatedAt,
}

const optionTrigger: BookingQuestionOptionTrigger = {
  id: "bqot_1",
  productBookingQuestionId: "pbq_1",
  optionId: "popt_1",
  triggerMode: "optional",
  active: true,
  createdAt,
  updatedAt,
}

const extraTrigger: BookingQuestionExtraTrigger = {
  id: "bqet_1",
  productBookingQuestionId: "pbq_1",
  productExtraId: null,
  optionExtraConfigId: null,
  triggerMode: "hidden",
  minQuantity: null,
  active: true,
  createdAt,
  updatedAt,
}

const answer: BookingAnswer = {
  id: "ba_1",
  bookingId: "bkg_1",
  productBookingQuestionId: "pbq_1",
  bookingTravelerId: null,
  bookingExtraId: null,
  target: "traveler",
  valueText: "VeganAnswer",
  valueNumber: null,
  valueBoolean: null,
  valueJson: ["vegan", "gluten_free"],
  notes: null,
  createdAt,
  updatedAt,
}

describe("booking-requirements admin contract", () => {
  it("contact requirement row schema accepts a serialized row (§17 dates→strings)", () => {
    const parsed = productContactRequirementSchema.parse(toWire(contactRequirement))
    expect(parsed.id).toBe("pcr_1")
    expect(parsed.fieldKey).toBe("passport_number")
    expect(typeof parsed.createdAt).toBe("string")
    expect(parsed.createdAt).toBe("2026-05-15T10:00:00.000Z")
    expect(parsed.updatedAt).toBe("2026-05-15T11:00:00.000Z")
    expect(parsed.optionId).toBeNull()
  })

  it("question row schema accepts metadata jsonb + nullable columns", () => {
    const parsed = productBookingQuestionSchema.parse(toWire(question))
    expect(parsed.fieldType).toBe("single_select")
    expect(parsed.metadata).toEqual({ source: "intake" })
    expect(parsed.description).toBeNull()
  })

  it("option-question row schema accepts a serialized row", () => {
    const parsed = optionBookingQuestionSchema.parse(toWire(optionQuestion))
    expect(parsed.isRequiredOverride).toBe(true)
    expect(parsed.productBookingQuestionId).toBe("pbq_1")
  })

  it("question-option row schema accepts a serialized row", () => {
    const parsed = bookingQuestionOptionSchema.parse(toWire(questionOption))
    expect(parsed.value).toBe("vegan")
    expect(parsed.isDefault).toBe(false)
  })

  it("unit-trigger row schema accepts a serialized row", () => {
    const parsed = bookingQuestionUnitTriggerSchema.parse(toWire(unitTrigger))
    expect(parsed.triggerMode).toBe("required")
    expect(parsed.minQuantity).toBe(1)
  })

  it("option-trigger row schema accepts a serialized row", () => {
    const parsed = bookingQuestionOptionTriggerSchema.parse(toWire(optionTrigger))
    expect(parsed.triggerMode).toBe("optional")
    expect(parsed.optionId).toBe("popt_1")
  })

  it("extra-trigger row schema accepts nullable extra/option-config columns", () => {
    const parsed = bookingQuestionExtraTriggerSchema.parse(toWire(extraTrigger))
    expect(parsed.triggerMode).toBe("hidden")
    expect(parsed.productExtraId).toBeNull()
    expect(parsed.minQuantity).toBeNull()
  })

  it("answer row schema accepts a json[] value and nullable scalar values", () => {
    const parsed = bookingAnswerSchema.parse(toWire(answer))
    expect(parsed.valueJson).toEqual(["vegan", "gluten_free"])
    expect(parsed.valueNumber).toBeNull()
    expect(parsed.valueBoolean).toBeNull()
  })

  it("wraps rows in the canonical listResponseSchema envelope", () => {
    const envelope = listResponseSchema(productContactRequirementSchema)
    const parsed = envelope.parse(
      toWire({ data: [contactRequirement], total: 1, limit: 50, offset: 0 }),
    )
    expect(parsed.data).toHaveLength(1)
    expect(parsed.data[0]?.id).toBe("pcr_1")
    expect(parsed.total).toBe(1)
    expect(parsed.limit).toBe(50)
    expect(parsed.offset).toBe(0)
  })

  it("rejects a row missing required columns (schema is a real contract)", () => {
    const { id: _omit, ...withoutId } = toWire(answer) as Record<string, unknown>
    expect(() => bookingAnswerSchema.parse(withoutId)).toThrow(z.ZodError)
  })
})
