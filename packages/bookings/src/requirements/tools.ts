/** Module-owned Tools for booking requirement definitions and booking answers. */

import { defineTool, READ_ONLY_RISK, requireService, type ToolContext } from "@voyant-travel/tools"
import { listResponseSchema } from "@voyant-travel/types"
import { z } from "zod"

import {
  bookingAnswerListQuerySchema,
  bookingAnswerTargetSchema,
  bookingQuestionExtraTriggerListQuerySchema,
  bookingQuestionFieldTypeSchema,
  bookingQuestionOptionListQuerySchema,
  bookingQuestionOptionTriggerListQuerySchema,
  bookingQuestionTargetSchema,
  bookingQuestionTriggerModeSchema,
  bookingQuestionUnitTriggerListQuerySchema,
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
  optionBookingQuestionListQuerySchema,
  productBookingQuestionListQuerySchema,
  productContactRequirementListQuerySchema,
  publicTransportRequirementsQuerySchema,
  publicTransportRequirementsSchema,
  updateBookingAnswerSchema,
  updateBookingQuestionExtraTriggerSchema,
  updateBookingQuestionOptionSchema,
  updateBookingQuestionOptionTriggerSchema,
  updateBookingQuestionUnitTriggerSchema,
  updateOptionBookingQuestionSchema,
  updateProductBookingQuestionSchema,
  updateProductContactRequirementSchema,
} from "./validation.js"

const OWNER = "@voyant-travel/bookings#requirements"
const VERSION = "v1"
const READ_SCOPES = ["bookings:read"] as const
const PII_READ_SCOPES = ["bookings:read", "bookings-pii:read"] as const
const WRITE_SCOPES = ["bookings:write"] as const
const STAFF_AUDIENCE = { source: "grant", allowed: ["staff"] } as const
const PUBLIC_AUDIENCE = { source: "grant", allowed: ["staff", "customer"] } as const
const WRITE_RISK = {
  destructive: false,
  reversible: true,
  dryRunSupported: false,
  sideEffects: ["data-write"],
} as const
const idSchema = z.string().min(1)
const timestampSchema = z.string().datetime()
const jsonObjectSchema = z.record(z.string(), z.unknown())

type RequirementListServiceStem =
  | "ProductContactRequirements"
  | "ProductBookingQuestions"
  | "OptionBookingQuestions"
  | "BookingQuestionOptions"
  | "BookingQuestionUnitTriggers"
  | "BookingQuestionOptionTriggers"
  | "BookingQuestionExtraTriggers"
  | "BookingAnswers"
type RequirementItemServiceStem =
  | "ProductContactRequirement"
  | "ProductBookingQuestion"
  | "OptionBookingQuestion"
  | "BookingQuestionOption"
  | "BookingQuestionUnitTrigger"
  | "BookingQuestionOptionTrigger"
  | "BookingQuestionExtraTrigger"
  | "BookingAnswer"
export type BookingRequirementsOperation =
  | "getPublicTransportRequirements"
  | `list${RequirementListServiceStem}`
  | `get${RequirementItemServiceStem}ById`
  | `create${RequirementItemServiceStem}`
  | `update${RequirementItemServiceStem}`

const productContactRequirementSchema = z.object({
  id: idSchema,
  productId: z.string(),
  optionId: z.string().nullable(),
  fieldKey: contactRequirementFieldSchema,
  scope: contactRequirementScopeSchema,
  isRequired: z.boolean(),
  perTraveler: z.boolean(),
  active: z.boolean(),
  sortOrder: z.number().int(),
  notes: z.string().nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})
const productBookingQuestionSchema = z.object({
  id: idSchema,
  productId: z.string(),
  code: z.string().nullable(),
  label: z.string(),
  description: z.string().nullable(),
  target: bookingQuestionTargetSchema,
  fieldType: bookingQuestionFieldTypeSchema,
  placeholder: z.string().nullable(),
  helpText: z.string().nullable(),
  isRequired: z.boolean(),
  active: z.boolean(),
  sortOrder: z.number().int(),
  metadata: jsonObjectSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})
const optionBookingQuestionSchema = z.object({
  id: idSchema,
  optionId: z.string(),
  productBookingQuestionId: z.string(),
  isRequiredOverride: z.boolean().nullable(),
  active: z.boolean(),
  sortOrder: z.number().int(),
  notes: z.string().nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})
const bookingQuestionOptionSchema = z.object({
  id: idSchema,
  productBookingQuestionId: z.string(),
  value: z.string(),
  label: z.string(),
  sortOrder: z.number().int(),
  isDefault: z.boolean(),
  active: z.boolean(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})
const bookingQuestionUnitTriggerSchema = z.object({
  id: idSchema,
  productBookingQuestionId: z.string(),
  unitId: z.string(),
  triggerMode: bookingQuestionTriggerModeSchema,
  minQuantity: z.number().int().nullable(),
  active: z.boolean(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})
const bookingQuestionOptionTriggerSchema = z.object({
  id: idSchema,
  productBookingQuestionId: z.string(),
  optionId: z.string(),
  triggerMode: bookingQuestionTriggerModeSchema,
  active: z.boolean(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})
const bookingQuestionExtraTriggerSchema = z.object({
  id: idSchema,
  productBookingQuestionId: z.string(),
  productExtraId: z.string().nullable(),
  optionExtraConfigId: z.string().nullable(),
  triggerMode: bookingQuestionTriggerModeSchema,
  minQuantity: z.number().int().nullable(),
  active: z.boolean(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})
const bookingAnswerSchema = z.object({
  id: idSchema,
  bookingId: z.string(),
  productBookingQuestionId: z.string(),
  bookingTravelerId: z.string().nullable(),
  bookingExtraId: z.string().nullable(),
  target: bookingAnswerTargetSchema,
  valueText: z.string().nullable(),
  valueNumber: z.number().int().nullable(),
  valueBoolean: z.boolean().nullable(),
  valueJson: z.union([jsonObjectSchema, z.array(z.string())]).nullable(),
  notes: z.string().nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})

export interface BookingRequirementsToolServices {
  execute(operation: BookingRequirementsOperation, input: unknown): Promise<unknown>
}
export type BookingRequirementsToolContext = ToolContext & {
  bookingRequirements?: BookingRequirementsToolServices
}

function service(ctx: BookingRequirementsToolContext) {
  return requireService(ctx.bookingRequirements, "bookingRequirements")
}
function parseJsonResult<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  return schema.parse(toJsonValue(value))
}

interface CrudToolSpec {
  slug: string
  singularName: string
  pluralName: string
  serviceStem: string
  listInput: z.ZodType
  createInput: z.ZodObject
  updateInput: z.ZodObject
  output: z.ZodType
  piiRead?: boolean
}

function defineCrudTools(spec: CrudToolSpec) {
  const readMetadata = {
    owner: OWNER,
    capabilityVersion: VERSION,
    requiredScopes: spec.piiRead ? PII_READ_SCOPES : READ_SCOPES,
    audience: STAFF_AUDIENCE,
    tier: spec.piiRead ? ("sensitive" as const) : ("read" as const),
    riskPolicy: READ_ONLY_RISK,
    annotations: { readOnlyHint: true, idempotentHint: true },
  }
  const writeMetadata = {
    owner: OWNER,
    capabilityVersion: VERSION,
    requiredScopes: WRITE_SCOPES,
    audience: STAFF_AUDIENCE,
    tier: "sensitive" as const,
    riskPolicy: WRITE_RISK,
  }
  const idInput = z.object({ id: idSchema })
  const updateInput = spec.updateInput.extend({ id: idSchema })
  const listOutput = listResponseSchema(spec.output)

  return {
    list: defineTool({
      ...readMetadata,
      capabilityId: `${OWNER}.tool.list-${spec.slug}`,
      name: `list_${spec.pluralName}`,
      description: `List ${spec.pluralName.replaceAll("_", " ")} with filters and pagination.`,
      inputSchema: spec.listInput,
      outputSchema: listOutput,
      async handler(input, ctx: BookingRequirementsToolContext) {
        return parseJsonResult(
          listOutput,
          await service(ctx).execute(
            `list${spec.serviceStem}` as BookingRequirementsOperation,
            input,
          ),
        )
      },
    }),
    get: defineTool({
      ...readMetadata,
      capabilityId: `${OWNER}.tool.get-${spec.slug.replace(/s$/, "")}`,
      name: `get_${spec.singularName}`,
      description: `Read one ${spec.singularName.replaceAll("_", " ")} by id.`,
      inputSchema: idInput,
      outputSchema: spec.output.nullable(),
      async handler(input, ctx: BookingRequirementsToolContext) {
        return parseJsonResult(
          spec.output.nullable(),
          await service(ctx).execute(
            `get${spec.serviceStem.replace(/s$/, "")}ById` as BookingRequirementsOperation,
            input,
          ),
        )
      },
    }),
    create: defineTool({
      ...writeMetadata,
      capabilityId: `${OWNER}.tool.create-${spec.slug.replace(/s$/, "")}`,
      name: `create_${spec.singularName}`,
      description: `Create a ${spec.singularName.replaceAll("_", " ")}.`,
      inputSchema: spec.createInput,
      outputSchema: spec.output.nullable(),
      async handler(input, ctx: BookingRequirementsToolContext) {
        return parseJsonResult(
          spec.output.nullable(),
          await service(ctx).execute(
            `create${spec.serviceStem.replace(/s$/, "")}` as BookingRequirementsOperation,
            input,
          ),
        )
      },
    }),
    update: defineTool({
      ...writeMetadata,
      capabilityId: `${OWNER}.tool.update-${spec.slug.replace(/s$/, "")}`,
      name: `update_${spec.singularName}`,
      description: `Update a ${spec.singularName.replaceAll("_", " ")} without deleting it.`,
      inputSchema: updateInput,
      outputSchema: spec.output.nullable(),
      annotations: { idempotentHint: true },
      async handler(input, ctx: BookingRequirementsToolContext) {
        return parseJsonResult(
          spec.output.nullable(),
          await service(ctx).execute(
            `update${spec.serviceStem.replace(/s$/, "")}` as BookingRequirementsOperation,
            input,
          ),
        )
      },
    }),
  }
}

const contactRequirementTools = defineCrudTools({
  slug: "product-contact-requirements",
  singularName: "product_contact_requirement",
  pluralName: "product_contact_requirements",
  serviceStem: "ProductContactRequirements",
  listInput: productContactRequirementListQuerySchema,
  createInput: insertProductContactRequirementSchema,
  updateInput: updateProductContactRequirementSchema,
  output: productContactRequirementSchema,
})
const productQuestionTools = defineCrudTools({
  slug: "product-booking-questions",
  singularName: "product_booking_question",
  pluralName: "product_booking_questions",
  serviceStem: "ProductBookingQuestions",
  listInput: productBookingQuestionListQuerySchema,
  createInput: insertProductBookingQuestionSchema,
  updateInput: updateProductBookingQuestionSchema,
  output: productBookingQuestionSchema,
})
const optionQuestionTools = defineCrudTools({
  slug: "option-booking-questions",
  singularName: "option_booking_question",
  pluralName: "option_booking_questions",
  serviceStem: "OptionBookingQuestions",
  listInput: optionBookingQuestionListQuerySchema,
  createInput: insertOptionBookingQuestionSchema,
  updateInput: updateOptionBookingQuestionSchema,
  output: optionBookingQuestionSchema,
})
const questionOptionTools = defineCrudTools({
  slug: "booking-question-options",
  singularName: "booking_question_option",
  pluralName: "booking_question_options",
  serviceStem: "BookingQuestionOptions",
  listInput: bookingQuestionOptionListQuerySchema,
  createInput: insertBookingQuestionOptionSchema,
  updateInput: updateBookingQuestionOptionSchema,
  output: bookingQuestionOptionSchema,
})
const unitTriggerTools = defineCrudTools({
  slug: "booking-question-unit-triggers",
  singularName: "booking_question_unit_trigger",
  pluralName: "booking_question_unit_triggers",
  serviceStem: "BookingQuestionUnitTriggers",
  listInput: bookingQuestionUnitTriggerListQuerySchema,
  createInput: insertBookingQuestionUnitTriggerSchema,
  updateInput: updateBookingQuestionUnitTriggerSchema,
  output: bookingQuestionUnitTriggerSchema,
})
const optionTriggerTools = defineCrudTools({
  slug: "booking-question-option-triggers",
  singularName: "booking_question_option_trigger",
  pluralName: "booking_question_option_triggers",
  serviceStem: "BookingQuestionOptionTriggers",
  listInput: bookingQuestionOptionTriggerListQuerySchema,
  createInput: insertBookingQuestionOptionTriggerSchema,
  updateInput: updateBookingQuestionOptionTriggerSchema,
  output: bookingQuestionOptionTriggerSchema,
})
const extraTriggerTools = defineCrudTools({
  slug: "booking-question-extra-triggers",
  singularName: "booking_question_extra_trigger",
  pluralName: "booking_question_extra_triggers",
  serviceStem: "BookingQuestionExtraTriggers",
  listInput: bookingQuestionExtraTriggerListQuerySchema,
  createInput: insertBookingQuestionExtraTriggerSchema,
  updateInput: updateBookingQuestionExtraTriggerSchema,
  output: bookingQuestionExtraTriggerSchema,
})
const answerTools = defineCrudTools({
  slug: "booking-answers",
  singularName: "booking_answer",
  pluralName: "booking_answers",
  serviceStem: "BookingAnswers",
  listInput: bookingAnswerListQuerySchema,
  createInput: insertBookingAnswerSchema,
  updateInput: updateBookingAnswerSchema,
  output: bookingAnswerSchema,
  piiRead: true,
})

export const listProductContactRequirementsTool = contactRequirementTools.list
export const getProductContactRequirementTool = contactRequirementTools.get
export const createProductContactRequirementTool = contactRequirementTools.create
export const updateProductContactRequirementTool = contactRequirementTools.update
export const listProductBookingQuestionsTool = productQuestionTools.list
export const getProductBookingQuestionTool = productQuestionTools.get
export const createProductBookingQuestionTool = productQuestionTools.create
export const updateProductBookingQuestionTool = productQuestionTools.update
export const listOptionBookingQuestionsTool = optionQuestionTools.list
export const getOptionBookingQuestionTool = optionQuestionTools.get
export const createOptionBookingQuestionTool = optionQuestionTools.create
export const updateOptionBookingQuestionTool = optionQuestionTools.update
export const listBookingQuestionOptionsTool = questionOptionTools.list
export const getBookingQuestionOptionTool = questionOptionTools.get
export const createBookingQuestionOptionTool = questionOptionTools.create
export const updateBookingQuestionOptionTool = questionOptionTools.update
export const listBookingQuestionUnitTriggersTool = unitTriggerTools.list
export const getBookingQuestionUnitTriggerTool = unitTriggerTools.get
export const createBookingQuestionUnitTriggerTool = unitTriggerTools.create
export const updateBookingQuestionUnitTriggerTool = unitTriggerTools.update
export const listBookingQuestionOptionTriggersTool = optionTriggerTools.list
export const getBookingQuestionOptionTriggerTool = optionTriggerTools.get
export const createBookingQuestionOptionTriggerTool = optionTriggerTools.create
export const updateBookingQuestionOptionTriggerTool = optionTriggerTools.update
export const listBookingQuestionExtraTriggersTool = extraTriggerTools.list
export const getBookingQuestionExtraTriggerTool = extraTriggerTools.get
export const createBookingQuestionExtraTriggerTool = extraTriggerTools.create
export const updateBookingQuestionExtraTriggerTool = extraTriggerTools.update
export const listBookingAnswersTool = answerTools.list
export const getBookingAnswerTool = answerTools.get
export const createBookingAnswerTool = answerTools.create
export const updateBookingAnswerTool = answerTools.update

const publicTransportInputSchema = z
  .object({ productId: idSchema })
  .and(publicTransportRequirementsQuerySchema)
export const getPublicTransportRequirementsTool = defineTool({
  owner: OWNER,
  capabilityVersion: VERSION,
  capabilityId: `${OWNER}.tool.get-public-transport-requirements`,
  name: "get_public_transport_requirements",
  description: "Summarize passenger-document requirements for a product and optional option.",
  inputSchema: publicTransportInputSchema,
  outputSchema: publicTransportRequirementsSchema.nullable(),
  requiredScopes: READ_SCOPES,
  audience: PUBLIC_AUDIENCE,
  tier: "read",
  riskPolicy: READ_ONLY_RISK,
  annotations: { readOnlyHint: true, idempotentHint: true },
  async handler(input, ctx: BookingRequirementsToolContext) {
    return parseJsonResult(
      publicTransportRequirementsSchema.nullable(),
      await service(ctx).execute("getPublicTransportRequirements", input),
    )
  },
})

export const bookingRequirementsTools = [
  getPublicTransportRequirementsTool,
  ...Object.values(contactRequirementTools),
  ...Object.values(productQuestionTools),
  ...Object.values(optionQuestionTools),
  ...Object.values(questionOptionTools),
  ...Object.values(unitTriggerTools),
  ...Object.values(optionTriggerTools),
  ...Object.values(extraTriggerTools),
  ...Object.values(answerTools),
] as const

function toJsonValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(toJsonValue)
  if (typeof value !== "object" || value === null) return value
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, nested]) => [key, toJsonValue(nested)] as const)
      .filter(([, nested]) => nested !== undefined),
  )
}
