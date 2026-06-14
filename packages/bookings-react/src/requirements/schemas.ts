import { z } from "zod"

export const paginatedEnvelope = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    data: z.array(item),
    total: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
  })

export const productLiteSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string().nullable(),
  status: z.string(),
})

export type ProductLite = z.infer<typeof productLiteSchema>

export const questionTargetSchema = z.enum([
  "booking",
  "traveler",
  "lead_traveler",
  "booker",
  "extra",
  "service",
])

export const questionFieldTypeSchema = z.enum([
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

export const bookingQuestionSchema = z.object({
  id: z.string(),
  productId: z.string(),
  code: z.string().nullable(),
  label: z.string(),
  description: z.string().nullable(),
  target: questionTargetSchema,
  fieldType: questionFieldTypeSchema,
  placeholder: z.string().nullable(),
  helpText: z.string().nullable(),
  isRequired: z.boolean(),
  active: z.boolean(),
  sortOrder: z.number().int(),
})

export type BookingQuestion = z.infer<typeof bookingQuestionSchema>

export const bookingQuestionOptionSchema = z.object({
  id: z.string(),
  productBookingQuestionId: z.string(),
  value: z.string(),
  label: z.string(),
  sortOrder: z.number().int(),
  isDefault: z.boolean(),
  active: z.boolean(),
})

export type BookingQuestionOption = z.infer<typeof bookingQuestionOptionSchema>

export const contactFieldKeySchema = z.enum([
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

export const contactScopeSchema = z.enum(["booking", "lead_traveler", "traveler", "booker"])

export const contactRequirementSchema = z.object({
  id: z.string(),
  productId: z.string(),
  optionId: z.string().nullable(),
  fieldKey: contactFieldKeySchema,
  scope: contactScopeSchema,
  isRequired: z.boolean(),
  perTraveler: z.boolean(),
  active: z.boolean(),
  sortOrder: z.number().int(),
  notes: z.string().nullable(),
})

export type ContactRequirement = z.infer<typeof contactRequirementSchema>

export const productLiteListResponse = paginatedEnvelope(productLiteSchema)
export const bookingQuestionListResponse = paginatedEnvelope(bookingQuestionSchema)
export const bookingQuestionOptionListResponse = paginatedEnvelope(bookingQuestionOptionSchema)
export const contactRequirementListResponse = paginatedEnvelope(contactRequirementSchema)

export const transportRequirementFieldSchema = z.enum([
  "date_of_birth",
  "nationality",
  "passport_number",
  "passport_expiry",
])

export const publicTransportRequirementSummarySchema = z.object({
  fieldKey: transportRequirementFieldSchema,
  scope: contactScopeSchema,
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

export type PublicTransportRequirements = z.infer<typeof publicTransportRequirementsSchema>
