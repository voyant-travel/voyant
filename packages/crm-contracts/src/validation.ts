import { kmsEnvelopeSchema } from "@voyantjs/schema-kit/kms"
import { z } from "zod"

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export const entityTypeSchema = z.enum(["organization", "person", "quote", "activity"])

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
export const quoteStatusSchema = z.enum(["open", "won", "lost", "archived"])
export const quoteVersionStatusSchema = z.enum([
  "draft",
  "sent",
  "accepted",
  "declined",
  "superseded",
  "expired",
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

const nullableTrimmedStringSchema = z
  .string()
  .nullable()
  .optional()
  .transform((value) => (typeof value === "string" ? value.trim() || null : value))

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
  taxId: nullableTrimmedStringSchema,
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
export const mergeOrganizationSchema = z.object({
  mergeId: z.string().min(1),
})

export const organizationListSortFieldSchema = z.enum([
  "name",
  "industry",
  "relation",
  "status",
  "createdAt",
  "updatedAt",
])

export const organizationListSortDirSchema = z.enum(["asc", "desc"])

export const organizationListQuerySchema = paginationSchema
  .extend({
    ownerId: z.string().optional(),
    relation: relationTypeSchema.optional(),
    status: recordStatusSchema.optional(),
    search: z.string().optional(),
    taxId: z.string().optional(),
    tax_id: z.string().optional(),
    sortBy: organizationListSortFieldSchema.default("updatedAt"),
    sortDir: organizationListSortDirSchema.default("desc"),
  })
  .transform(({ tax_id: taxIdSnake, ...query }) => ({
    ...query,
    taxId: query.taxId?.trim() || taxIdSnake?.trim() || undefined,
  }))

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
  dateOfBirth: z.string().date().nullable().optional(),
  notes: z.string().nullable().optional(),
  // Encrypted PII slots (canonical store; documents live in person_documents).
  // `z.lazy(() => …)` defers cross-package schema dereferencing until
  // first parse — see #501 for the bundler chunk-init hazard otherwise.
  accessibilityEncrypted: z.lazy(() => kmsEnvelopeSchema).optional(),
  dietaryEncrypted: z.lazy(() => kmsEnvelopeSchema).optional(),
  loyaltyEncrypted: z.lazy(() => kmsEnvelopeSchema).optional(),
  insuranceEncrypted: z.lazy(() => kmsEnvelopeSchema).optional(),
  // Inline identity fields — synced to identity module on create/update
  email: z.preprocess(
    (value) => (value === "" ? null : value),
    z.string().email().nullable().optional(),
  ),
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
export const mergePersonSchema = z.object({
  mergeId: z.string().min(1),
})

export const personListSortFieldSchema = z.enum([
  "name",
  "relation",
  "status",
  "createdAt",
  "updatedAt",
])

export const personListSortDirSchema = z.enum(["asc", "desc"])

export const personListQuerySchema = paginationSchema.extend({
  organizationId: z.string().optional(),
  ownerId: z.string().optional(),
  relation: relationTypeSchema.optional(),
  status: recordStatusSchema.optional(),
  search: z.string().optional(),
  sortBy: personListSortFieldSchema.default("updatedAt"),
  sortDir: personListSortDirSchema.default("desc"),
})

export const pipelineCoreSchema = z.object({
  entityType: entityTypeSchema.default("quote"),
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

export const quoteCoreSchema = z.object({
  title: z.string().min(1),
  personId: z.string().nullable().optional(),
  organizationId: z.string().nullable().optional(),
  pipelineId: z.string(),
  stageId: z.string(),
  ownerId: z.string().nullable().optional(),
  status: quoteStatusSchema.default("open"),
  acceptedVersionId: z.string().nullable().optional(),
  valueAmountCents: z.number().int().nullable().optional(),
  valueCurrency: z.string().nullable().optional(),
  expectedCloseDate: z.string().date().nullable().optional(),
  source: z.string().nullable().optional(),
  sourceRef: z.string().nullable().optional(),
  lostReason: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
})

export const insertQuoteSchema = quoteCoreSchema
export const updateQuoteSchema = quoteCoreSchema.partial()
export const quoteListQuerySchema = paginationSchema.extend({
  personId: z.string().optional(),
  organizationId: z.string().optional(),
  pipelineId: z.string().optional(),
  stageId: z.string().optional(),
  ownerId: z.string().optional(),
  status: quoteStatusSchema.optional(),
  search: z.string().optional(),
})

export const insertQuoteParticipantSchema = z.object({
  personId: z.string(),
  role: participantRoleSchema.default("other"),
  isPrimary: z.boolean().default(false),
})

export const insertQuoteProductSchema = z.object({
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

export const updateQuoteProductSchema = insertQuoteProductSchema.partial()

export const quoteVersionCoreSchema = z.object({
  quoteId: z.string(),
  label: z.string().nullable().optional(),
  status: quoteVersionStatusSchema.default("draft"),
  supersedesId: z.string().nullable().optional(),
  tripSnapshotId: z.string().nullable().optional(),
  validUntil: z.string().date().nullable().optional(),
  currency: z.string().min(1),
  subtotalAmountCents: z.number().int().default(0),
  taxAmountCents: z.number().int().default(0),
  totalAmountCents: z.number().int().default(0),
  notes: z.string().nullable().optional(),
  sentAt: z.string().datetime().nullable().optional(),
  viewedAt: z.string().datetime().nullable().optional(),
  decidedAt: z.string().datetime().nullable().optional(),
})

export const insertQuoteVersionSchema = quoteVersionCoreSchema
export const updateQuoteVersionSchema = quoteVersionCoreSchema.partial()
export const quoteVersionListQuerySchema = paginationSchema.extend({
  quoteId: z.string().optional(),
  status: quoteVersionStatusSchema.optional(),
})

export const quoteVersionLineCoreSchema = z.object({
  productId: z.string().nullable().optional(),
  supplierServiceId: z.string().nullable().optional(),
  description: z.string().min(1),
  quantity: z.number().int().min(1).default(1),
  unitPriceAmountCents: z.number().int().default(0),
  totalAmountCents: z.number().int().default(0),
  currency: z.string().min(1),
})

export const insertQuoteVersionLineSchema = quoteVersionLineCoreSchema
export const updateQuoteVersionLineSchema = quoteVersionLineCoreSchema.partial()

export const applyTripSnapshotQuoteVersionLineSchema = quoteVersionLineCoreSchema.extend({
  componentId: z.string().nullable().optional(),
})

export const applyTripSnapshotToQuoteVersionSchema = z.object({
  tripSnapshotId: z.string().min(1),
  currency: z.string().min(1),
  subtotalAmountCents: z.number().int().default(0),
  taxAmountCents: z.number().int().default(0),
  totalAmountCents: z.number().int().default(0),
  lines: z.array(applyTripSnapshotQuoteVersionLineSchema).default([]),
})

export const sendQuoteVersionSchema = z.object({
  validUntil: z.string().date().nullable().optional(),
})

export const declineQuoteVersionSchema = z.object({})

export const expireQuoteVersionsSchema = z.object({
  now: z.string().datetime().optional(),
})

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

// ---------- person documents ----------

export const personDocumentTypeSchema = z.enum([
  "passport",
  "id_card",
  "driver_license",
  "visa",
  "other",
])

export const personDocumentCoreSchema = z.object({
  type: personDocumentTypeSchema,
  // `z.lazy` for cross-package init-cycle protection — see #501.
  numberEncrypted: z.lazy(() => kmsEnvelopeSchema).optional(),
  issuingAuthority: z.string().nullable().optional(),
  issuingCountry: z.string().nullable().optional(),
  issueDate: z.string().date().nullable().optional(),
  expiryDate: z.string().date().nullable().optional(),
  attachmentId: z.string().nullable().optional(),
  isPrimary: z.boolean().default(false),
  notes: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

export const insertPersonDocumentSchema = personDocumentCoreSchema
export const updatePersonDocumentSchema = personDocumentCoreSchema.partial()
export const personDocumentListQuerySchema = paginationSchema.extend({
  type: personDocumentTypeSchema.optional(),
  expiringBefore: z.string().date().optional(),
})

/**
 * Plaintext input shape for admin-facing create/update endpoints —
 * the route encrypts `number` server-side using the people KMS key
 * before persisting. Operator UIs prefer this over hand-encrypted
 * envelopes.
 */
const personDocumentPlaintextCoreSchema = z.object({
  type: personDocumentTypeSchema,
  number: z.string().max(255).nullable().optional(),
  issuingAuthority: z.string().nullable().optional(),
  issuingCountry: z.string().nullable().optional(),
  issueDate: z.string().date().nullable().optional(),
  expiryDate: z.string().date().nullable().optional(),
  attachmentId: z.string().nullable().optional(),
  isPrimary: z.boolean().default(false),
  notes: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

export const insertPersonDocumentFromPlaintextSchema = personDocumentPlaintextCoreSchema
export const updatePersonDocumentFromPlaintextSchema = personDocumentPlaintextCoreSchema.partial()

/**
 * Plaintext input shape for the four free-text PII slots on
 * `crm.people` (accessibility / dietary / loyalty / insurance). The
 * admin endpoint encrypts each provided value server-side; `null`
 * clears the slot.
 */
export const updatePersonProfilePiiSchema = z
  .object({
    accessibility: z.string().max(4000).nullable().optional(),
    dietary: z.string().max(4000).nullable().optional(),
    loyalty: z.string().max(4000).nullable().optional(),
    insurance: z.string().max(4000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  })

export type PersonDocumentInput = z.infer<typeof insertPersonDocumentSchema>
export type PersonDocumentUpdate = z.infer<typeof updatePersonDocumentSchema>
export type PersonDocumentPlaintextInput = z.infer<typeof insertPersonDocumentFromPlaintextSchema>
export type PersonDocumentPlaintextUpdate = z.infer<typeof updatePersonDocumentFromPlaintextSchema>
export type UpdatePersonProfilePiiInput = z.infer<typeof updatePersonProfilePiiSchema>

// ---------- customer signals ----------

export const customerSignalKindSchema = z.enum([
  "wishlist",
  "notify",
  "inquiry",
  "request_offer",
  "referral",
])

export const customerSignalSourceSchema = z.enum([
  "form",
  "phone",
  "admin",
  "abandoned_cart",
  "website",
  "booking",
])

export const customerSignalStatusSchema = z.enum([
  "new",
  "contacted",
  "qualified",
  "converted",
  "lost",
  "expired",
])

export const customerSignalPrioritySchema = z.enum(["low", "normal", "high", "urgent"])

const customerSignalCoreSchema = z.object({
  personId: z.string().min(1),
  productId: z.string().nullable().optional(),
  optionUnitId: z.string().nullable().optional(),
  kind: customerSignalKindSchema,
  source: customerSignalSourceSchema,
  status: customerSignalStatusSchema.default("new"),
  priority: customerSignalPrioritySchema.default("normal"),
  notes: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  assignedToUserId: z.string().nullable().optional(),
  followUpAt: z.string().datetime().nullable().optional(),
  resolvedBookingId: z.string().nullable().optional(),
  sourceSubmissionId: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

export const insertCustomerSignalSchema = customerSignalCoreSchema
export const updateCustomerSignalSchema = customerSignalCoreSchema
  .partial()
  .omit({ personId: true })

export const customerSignalListQuerySchema = paginationSchema.extend({
  personId: z.string().optional(),
  assignedToUserId: z.string().optional(),
  status: customerSignalStatusSchema.optional(),
  kind: customerSignalKindSchema.optional(),
  productId: z.string().optional(),
  search: z.string().optional(),
})

export const resolveCustomerSignalSchema = z.object({
  bookingId: z.string().min(1),
})

export type CustomerSignalInput = z.infer<typeof insertCustomerSignalSchema>
export type CustomerSignalUpdate = z.infer<typeof updateCustomerSignalSchema>
export type CustomerSignalListQueryInput = z.infer<typeof customerSignalListQuerySchema>
export type ResolveCustomerSignalInput = z.infer<typeof resolveCustomerSignalSchema>

// ---------- person relationships ----------

export const personRelationshipKindSchema = z.enum([
  "spouse",
  "partner",
  "parent",
  "child",
  "sibling",
  "guardian",
  "ward",
  "emergency_contact",
  "friend",
  "travel_companion",
  "other",
])

const personRelationshipCoreSchema = z.object({
  toPersonId: z.string().min(1),
  kind: personRelationshipKindSchema,
  inverseKind: personRelationshipKindSchema.nullable().optional(),
  startDate: z.string().date().nullable().optional(),
  endDate: z.string().date().nullable().optional(),
  isPrimary: z.boolean().default(false),
  notes: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  /**
   * Set to false to skip writing the symmetric edge when
   * `inverseKind` is provided. Defaults to `true` so operator UIs
   * don't have to maintain both sides.
   */
  autoInverse: z.boolean().optional(),
})

export const insertPersonRelationshipSchema = personRelationshipCoreSchema
export const updatePersonRelationshipSchema = personRelationshipCoreSchema
  .partial()
  .omit({ toPersonId: true, autoInverse: true })

export const personRelationshipListQuerySchema = paginationSchema.extend({
  kind: personRelationshipKindSchema.optional(),
  /**
   * `from` returns only outgoing edges, `to` only incoming, `both`
   * (the default) returns the union — the typical UI shape.
   */
  direction: z.enum(["from", "to", "both"]).default("both"),
})

export type PersonRelationshipInput = z.infer<typeof insertPersonRelationshipSchema>
export type PersonRelationshipUpdate = z.infer<typeof updatePersonRelationshipSchema>
export type PersonRelationshipListQueryInput = z.infer<typeof personRelationshipListQuerySchema>

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
