import { booleanQueryParam } from "@voyantjs/db/helpers"
import { z } from "zod"

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export const contactRequirementFieldSchema = z.enum([
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
])

export const contactRequirementScopeSchema = z.enum([
  "booking",
  "lead_traveler",
  "traveler",
  "booker",
])

export const bookingQuestionTargetSchema = z.enum([
  "booking",
  "traveler",
  "lead_traveler",
  "booker",
  "extra",
  "service",
])

export const bookingQuestionFieldTypeSchema = z.enum([
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
])

export const bookingQuestionTriggerModeSchema = z.enum(["required", "optional", "hidden"])
export const bookingAnswerTargetSchema = z.enum(["booking", "traveler", "extra"])

export const productContactRequirementCoreSchema = z.object({
  productId: z.string(),
  optionId: z.string().nullable().optional(),
  fieldKey: contactRequirementFieldSchema,
  scope: contactRequirementScopeSchema.default("traveler"),
  isRequired: z.boolean().default(false),
  perTraveler: z.boolean().default(false),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  notes: z.string().nullable().optional(),
})

export const insertProductContactRequirementSchema = productContactRequirementCoreSchema
export const updateProductContactRequirementSchema = productContactRequirementCoreSchema.partial()
export const productContactRequirementListQuerySchema = paginationSchema.extend({
  productId: z.string().optional(),
  optionId: z.string().optional(),
  active: booleanQueryParam.optional(),
})

export const publicTransportRequirementsQuerySchema = z.object({
  optionId: z.string().optional(),
})

export const transportRequirementFieldSchema = z.enum([
  "date_of_birth",
  "nationality",
  "passport_number",
  "passport_expiry",
])

export const publicTransportRequirementSummarySchema = z.object({
  fieldKey: transportRequirementFieldSchema,
  scope: contactRequirementScopeSchema,
  isRequired: z.boolean(),
  perTraveler: z.boolean(),
  notes: z.string().nullable(),
})

export const publicTransportRequirementsSchema = z.object({
  productId: z.string(),
  optionId: z.string().nullable(),
  hasTransport: z.boolean(),
  requiresPassengerDocuments: z.boolean(),
  requiresPassport: z.boolean(),
  requiresNationality: z.boolean(),
  requiresDateOfBirth: z.boolean(),
  requiredFields: z.array(transportRequirementFieldSchema),
  fieldsByScope: z.object({
    booking: z.array(transportRequirementFieldSchema),
    lead_traveler: z.array(transportRequirementFieldSchema),
    traveler: z.array(transportRequirementFieldSchema),
    booker: z.array(transportRequirementFieldSchema),
  }),
  requirements: z.array(publicTransportRequirementSummarySchema),
})

export const productBookingQuestionCoreSchema = z.object({
  productId: z.string(),
  code: z.string().max(100).nullable().optional(),
  label: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  target: bookingQuestionTargetSchema.default("booking"),
  fieldType: bookingQuestionFieldTypeSchema.default("text"),
  placeholder: z.string().nullable().optional(),
  helpText: z.string().nullable().optional(),
  isRequired: z.boolean().default(false),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

export const insertProductBookingQuestionSchema = productBookingQuestionCoreSchema
export const updateProductBookingQuestionSchema = productBookingQuestionCoreSchema.partial()
export const productBookingQuestionListQuerySchema = paginationSchema.extend({
  productId: z.string().optional(),
  target: bookingQuestionTargetSchema.optional(),
  fieldType: bookingQuestionFieldTypeSchema.optional(),
  active: booleanQueryParam.optional(),
})

export const optionBookingQuestionCoreSchema = z.object({
  optionId: z.string(),
  productBookingQuestionId: z.string(),
  isRequiredOverride: z.boolean().nullable().optional(),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  notes: z.string().nullable().optional(),
})

export const insertOptionBookingQuestionSchema = optionBookingQuestionCoreSchema
export const updateOptionBookingQuestionSchema = optionBookingQuestionCoreSchema.partial()
export const optionBookingQuestionListQuerySchema = paginationSchema.extend({
  optionId: z.string().optional(),
  productBookingQuestionId: z.string().optional(),
  active: booleanQueryParam.optional(),
})

export const bookingQuestionOptionCoreSchema = z.object({
  productBookingQuestionId: z.string(),
  value: z.string().min(1).max(255),
  label: z.string().min(1).max(255),
  sortOrder: z.number().int().default(0),
  isDefault: z.boolean().default(false),
  active: z.boolean().default(true),
})

export const insertBookingQuestionOptionSchema = bookingQuestionOptionCoreSchema
export const updateBookingQuestionOptionSchema = bookingQuestionOptionCoreSchema.partial()
export const bookingQuestionOptionListQuerySchema = paginationSchema.extend({
  productBookingQuestionId: z.string().optional(),
  active: booleanQueryParam.optional(),
})

export const bookingQuestionUnitTriggerCoreSchema = z.object({
  productBookingQuestionId: z.string(),
  unitId: z.string(),
  triggerMode: bookingQuestionTriggerModeSchema.default("required"),
  minQuantity: z.number().int().min(0).nullable().optional(),
  active: z.boolean().default(true),
})

export const insertBookingQuestionUnitTriggerSchema = bookingQuestionUnitTriggerCoreSchema
export const updateBookingQuestionUnitTriggerSchema = bookingQuestionUnitTriggerCoreSchema.partial()
export const bookingQuestionUnitTriggerListQuerySchema = paginationSchema.extend({
  productBookingQuestionId: z.string().optional(),
  unitId: z.string().optional(),
  active: booleanQueryParam.optional(),
})

export const bookingQuestionOptionTriggerCoreSchema = z.object({
  productBookingQuestionId: z.string(),
  optionId: z.string(),
  triggerMode: bookingQuestionTriggerModeSchema.default("required"),
  active: z.boolean().default(true),
})

export const insertBookingQuestionOptionTriggerSchema = bookingQuestionOptionTriggerCoreSchema
export const updateBookingQuestionOptionTriggerSchema =
  bookingQuestionOptionTriggerCoreSchema.partial()
export const bookingQuestionOptionTriggerListQuerySchema = paginationSchema.extend({
  productBookingQuestionId: z.string().optional(),
  optionId: z.string().optional(),
  active: booleanQueryParam.optional(),
})

export const bookingQuestionExtraTriggerCoreSchema = z.object({
  productBookingQuestionId: z.string(),
  productExtraId: z.string().nullable().optional(),
  optionExtraConfigId: z.string().nullable().optional(),
  triggerMode: bookingQuestionTriggerModeSchema.default("required"),
  minQuantity: z.number().int().min(0).nullable().optional(),
  active: z.boolean().default(true),
})

export const insertBookingQuestionExtraTriggerSchema = bookingQuestionExtraTriggerCoreSchema
export const updateBookingQuestionExtraTriggerSchema =
  bookingQuestionExtraTriggerCoreSchema.partial()
export const bookingQuestionExtraTriggerListQuerySchema = paginationSchema.extend({
  productBookingQuestionId: z.string().optional(),
  productExtraId: z.string().optional(),
  optionExtraConfigId: z.string().optional(),
  active: booleanQueryParam.optional(),
})

export const bookingAnswerCoreSchema = z.object({
  bookingId: z.string(),
  productBookingQuestionId: z.string(),
  bookingTravelerId: z.string().nullable().optional(),
  bookingExtraId: z.string().nullable().optional(),
  target: bookingAnswerTargetSchema.default("booking"),
  valueText: z.string().nullable().optional(),
  valueNumber: z.number().int().nullable().optional(),
  valueBoolean: z.boolean().nullable().optional(),
  valueJson: z
    .union([z.record(z.string(), z.unknown()), z.array(z.string())])
    .nullable()
    .optional(),
  notes: z.string().nullable().optional(),
})

export const insertBookingAnswerSchema = bookingAnswerCoreSchema
export const updateBookingAnswerSchema = bookingAnswerCoreSchema.partial()
export const bookingAnswerListQuerySchema = paginationSchema.extend({
  bookingId: z.string().optional(),
  productBookingQuestionId: z.string().optional(),
  bookingTravelerId: z.string().optional(),
  bookingExtraId: z.string().optional(),
  target: bookingAnswerTargetSchema.optional(),
})
