import { z } from "zod"

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export const entityTypeSchema = z.enum([
  "organization",
  "person",
  "opportunity",
  "quote",
  "activity",
])

export const recordStatusSchema = z.enum(["active", "inactive", "archived"])
export const relationTypeSchema = z.enum(["client", "partner", "supplier", "other"])
export const communicationChannelSchema = z.enum([
  "email",
  "phone",
  "whatsapp",
  "sms",
  "meeting",
  "other",
])
export const communicationDirectionSchema = z.enum(["inbound", "outbound"])
export const opportunityStatusSchema = z.enum(["open", "won", "lost", "archived"])
export const quoteStatusSchema = z.enum([
  "draft",
  "sent",
  "accepted",
  "expired",
  "rejected",
  "archived",
])
export const activityTypeSchema = z.enum(["call", "email", "meeting", "task", "follow_up", "note"])
export const activityStatusSchema = z.enum(["planned", "done", "cancelled"])
export const participantRoleSchema = z.enum([
  "traveler",
  "booker",
  "decision_maker",
  "finance",
  "other",
])
export const activityLinkRoleSchema = z.enum(["primary", "related"])
export const customFieldTypeSchema = z.enum([
  "varchar",
  "text",
  "double",
  "monetary",
  "date",
  "boolean",
  "enum",
  "set",
  "json",
  "address",
  "phone",
])

export const organizationCoreSchema = z.object({
  name: z.string().min(1),
  legalName: z.string().nullable().optional(),
  website: z
    .string()
    .url()
    .nullable()
    .optional()
    .or(z.literal(""))
    .transform((v) => v || null),
  vatNumber: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  relation: relationTypeSchema.nullable().optional(),
  ownerId: z.string().nullable().optional(),
  defaultCurrency: z.string().nullable().optional(),
  preferredLanguage: z.string().nullable().optional(),
  paymentTerms: z.number().int().positive().nullable().optional(),
  status: recordStatusSchema.default("active"),
  source: z.string().nullable().optional(),
  sourceRef: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().nullable().optional(),
})

export const insertOrganizationSchema = organizationCoreSchema
export const updateOrganizationSchema = organizationCoreSchema.partial()
export const organizationListQuerySchema = paginationSchema.extend({
  ownerId: z.string().optional(),
  relation: relationTypeSchema.optional(),
  status: recordStatusSchema.optional(),
  search: z.string().optional(),
})

export const personCoreSchema = z.object({
  organizationId: z.string().nullable().optional(),
  firstName: z.string().min(1),
  middleName: z.string().nullable().optional(),
  lastName: z.string().min(1),
  gender: z.enum(["M", "F", "X"]).nullable().optional(),
  jobTitle: z.string().nullable().optional(),
  relation: relationTypeSchema.nullable().optional(),
  preferredLanguage: z.string().nullable().optional(),
  preferredCurrency: z.string().nullable().optional(),
  ownerId: z.string().nullable().optional(),
  status: recordStatusSchema.default("active"),
  source: z.string().nullable().optional(),
  sourceRef: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  birthday: z.string().date().nullable().optional(),
  notes: z.string().nullable().optional(),
  // Inline identity fields — synced to identity module on create/update
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  website: z
    .string()
    .url()
    .nullable()
    .optional()
    .or(z.literal(""))
    .transform((v) => v || null),
})

export const insertPersonSchema = personCoreSchema
export const updatePersonSchema = personCoreSchema.partial()
export const personListQuerySchema = paginationSchema.extend({
  organizationId: z.string().optional(),
  ownerId: z.string().optional(),
  relation: relationTypeSchema.optional(),
  status: recordStatusSchema.optional(),
  search: z.string().optional(),
})

export const pipelineCoreSchema = z.object({
  entityType: entityTypeSchema.default("opportunity"),
  name: z.string().min(1),
  isDefault: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
})

export const insertPipelineSchema = pipelineCoreSchema
export const updatePipelineSchema = pipelineCoreSchema.partial()
export const pipelineListQuerySchema = paginationSchema.extend({
  entityType: entityTypeSchema.optional(),
})

export const stageCoreSchema = z.object({
  pipelineId: z.string(),
  name: z.string().min(1),
  sortOrder: z.number().int().default(0),
  probability: z.number().int().min(0).max(100).nullable().optional(),
  isClosed: z.boolean().default(false),
  isWon: z.boolean().default(false),
  isLost: z.boolean().default(false),
})

export const insertStageSchema = stageCoreSchema
export const updateStageSchema = stageCoreSchema.partial()
export const stageListQuerySchema = paginationSchema.extend({
  pipelineId: z.string().optional(),
})

export const opportunityCoreSchema = z.object({
  title: z.string().min(1),
  personId: z.string().nullable().optional(),
  organizationId: z.string().nullable().optional(),
  pipelineId: z.string(),
  stageId: z.string(),
  ownerId: z.string().nullable().optional(),
  status: opportunityStatusSchema.default("open"),
  valueAmountCents: z.number().int().nullable().optional(),
  valueCurrency: z.string().nullable().optional(),
  expectedCloseDate: z.string().date().nullable().optional(),
  source: z.string().nullable().optional(),
  sourceRef: z.string().nullable().optional(),
  lostReason: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
})

export const insertOpportunitySchema = opportunityCoreSchema
export const updateOpportunitySchema = opportunityCoreSchema.partial()
export const opportunityListQuerySchema = paginationSchema.extend({
  personId: z.string().optional(),
  organizationId: z.string().optional(),
  pipelineId: z.string().optional(),
  stageId: z.string().optional(),
  ownerId: z.string().optional(),
  status: opportunityStatusSchema.optional(),
  search: z.string().optional(),
})

export const insertOpportunityParticipantSchema = z.object({
  personId: z.string(),
  role: participantRoleSchema.default("other"),
  isPrimary: z.boolean().default(false),
})

export const insertOpportunityProductSchema = z.object({
  productId: z.string().nullable().optional(),
  supplierServiceId: z.string().nullable().optional(),
  nameSnapshot: z.string().min(1),
  description: z.string().nullable().optional(),
  quantity: z.number().int().min(1).default(1),
  unitPriceAmountCents: z.number().int().nullable().optional(),
  costAmountCents: z.number().int().nullable().optional(),
  currency: z.string().nullable().optional(),
  discountAmountCents: z.number().int().nullable().optional(),
})

export const updateOpportunityProductSchema = insertOpportunityProductSchema.partial()

export const quoteCoreSchema = z.object({
  opportunityId: z.string(),
  status: quoteStatusSchema.default("draft"),
  validUntil: z.string().date().nullable().optional(),
  currency: z.string().min(1),
  subtotalAmountCents: z.number().int().default(0),
  taxAmountCents: z.number().int().default(0),
  totalAmountCents: z.number().int().default(0),
  notes: z.string().nullable().optional(),
})

export const insertQuoteSchema = quoteCoreSchema
export const updateQuoteSchema = quoteCoreSchema.partial()
export const quoteListQuerySchema = paginationSchema.extend({
  opportunityId: z.string().optional(),
  status: quoteStatusSchema.optional(),
})

export const quoteLineCoreSchema = z.object({
  productId: z.string().nullable().optional(),
  supplierServiceId: z.string().nullable().optional(),
  description: z.string().min(1),
  quantity: z.number().int().min(1).default(1),
  unitPriceAmountCents: z.number().int().default(0),
  totalAmountCents: z.number().int().default(0),
  currency: z.string().min(1),
})

export const insertQuoteLineSchema = quoteLineCoreSchema
export const updateQuoteLineSchema = quoteLineCoreSchema.partial()

export const activityCoreSchema = z.object({
  subject: z.string().min(1),
  type: activityTypeSchema,
  ownerId: z.string().nullable().optional(),
  status: activityStatusSchema.default("planned"),
  dueAt: z.string().datetime().nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
  location: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
})

export const insertActivitySchema = activityCoreSchema
export const updateActivitySchema = activityCoreSchema.partial()
export const activityListQuerySchema = paginationSchema.extend({
  ownerId: z.string().optional(),
  status: activityStatusSchema.optional(),
  type: activityTypeSchema.optional(),
  entityType: entityTypeSchema.optional(),
  entityId: z.string().optional(),
  search: z.string().optional(),
})

export const insertActivityLinkSchema = z.object({
  entityType: entityTypeSchema,
  entityId: z.string(),
  role: activityLinkRoleSchema.default("related"),
})

export const insertActivityParticipantSchema = z.object({
  personId: z.string(),
  isPrimary: z.boolean().default(false),
})

export const customFieldDefinitionCoreSchema = z.object({
  entityType: entityTypeSchema,
  key: z.string().min(1),
  label: z.string().min(1),
  fieldType: customFieldTypeSchema,
  isRequired: z.boolean().default(false),
  isSearchable: z.boolean().default(false),
  options: z
    .array(z.object({ label: z.string(), value: z.string() }))
    .nullable()
    .optional(),
})

export const insertCustomFieldDefinitionSchema = customFieldDefinitionCoreSchema
export const updateCustomFieldDefinitionSchema = customFieldDefinitionCoreSchema.partial()
export const customFieldDefinitionListQuerySchema = paginationSchema.extend({
  entityType: entityTypeSchema.optional(),
})

export const upsertCustomFieldValueSchema = z.object({
  entityType: entityTypeSchema,
  entityId: z.string(),
  textValue: z.string().nullable().optional(),
  numberValue: z.number().int().nullable().optional(),
  dateValue: z.string().date().nullable().optional(),
  booleanValue: z.boolean().nullable().optional(),
  monetaryValueCents: z.number().int().nullable().optional(),
  currencyCode: z.string().nullable().optional(),
  jsonValue: z.record(z.string(), z.unknown()).or(z.array(z.string())).nullable().optional(),
})

export const customFieldValueListQuerySchema = paginationSchema.extend({
  entityType: entityTypeSchema.optional(),
  entityId: z.string().optional(),
  definitionId: z.string().optional(),
})

// ---------- notes ----------

export const insertPersonNoteSchema = z.object({
  content: z.string().min(1).max(10000),
})

export const updatePersonNoteSchema = z.object({
  content: z.string().min(1).max(10000),
})

export const insertOrganizationNoteSchema = z.object({
  content: z.string().min(1).max(10000),
})

// ---------- payment methods ----------

export const paymentMethodBrandSchema = z.enum([
  "visa",
  "mastercard",
  "amex",
  "revolut",
  "bank_transfer",
])

const paymentMethodCoreSchema = z.object({
  brand: paymentMethodBrandSchema,
  last4: z.string().min(2).max(8).nullable().optional(),
  holderName: z.string().nullable().optional(),
  expMonth: z.number().int().min(1).max(12).nullable().optional(),
  expYear: z.number().int().min(2000).max(2100).nullable().optional(),
  processorToken: z.string().min(1),
  isDefault: z.boolean().default(false),
})

export const insertPersonPaymentMethodSchema = paymentMethodCoreSchema
export const updatePersonPaymentMethodSchema = paymentMethodCoreSchema.partial()

export type InsertPersonPaymentMethodInput = z.infer<typeof insertPersonPaymentMethodSchema>
export type UpdatePersonPaymentMethodInput = z.infer<typeof updatePersonPaymentMethodSchema>

export const updateOrganizationNoteSchema = z.object({
  content: z.string().min(1).max(10000),
})

// ---------- communication log ----------

export const insertCommunicationLogSchema = z.object({
  organizationId: z.string().nullable().optional(),
  channel: communicationChannelSchema,
  direction: communicationDirectionSchema,
  subject: z.string().max(500).nullable().optional(),
  content: z.string().nullable().optional(),
  sentAt: z.string().nullable().optional(),
})

export const communicationListQuerySchema = paginationSchema.extend({
  channel: communicationChannelSchema.optional(),
  direction: communicationDirectionSchema.optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
})

// ---------- segments ----------

export const insertSegmentSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  conditions: z.record(z.string(), z.unknown()).nullable().optional(),
})
