import { z } from "zod"

/**
 * Shared API response envelope schemas. The Voyant CRM routes wrap payloads in
 * either `{ data, total, limit, offset }` (lists) or `{ data }` (single
 * resource) so we assemble typed schemas from those envelopes here.
 */

export const paginatedEnvelope = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    data: z.array(item),
    total: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
  })

export const singleEnvelope = <T extends z.ZodTypeAny>(item: T) => z.object({ data: item })

export const listEnvelope = <T extends z.ZodTypeAny>(item: T) => z.object({ data: z.array(item) })

export const successEnvelope = z.object({ success: z.boolean() })

/**
 * Loose Person/Organization schemas — these describe the shape returned by the
 * API (DB rows + hydrated identity fields + timestamps) without forcing
 * consumers to depend on the Drizzle type inference chain. The hooks expose
 * these as `z.infer` types; keep in sync with `packages/crm/src/schema.ts`.
 */

/**
 * KMS-encrypted envelope shape — `{ enc: base64 }`. Mirrors the
 * `kmsEnvelopeSchema` in `@voyantjs/db/schema/iam/kms` (kept inline
 * here so crm-react has no server-side schema dep).
 */
export const kmsEnvelopeRecordSchema = z.object({ enc: z.string().min(1) }).nullable()

export type KmsEnvelopeRecord = z.infer<typeof kmsEnvelopeRecordSchema>

export const personRecordSchema = z.object({
  id: z.string(),
  organizationId: z.string().nullable(),
  firstName: z.string(),
  middleName: z.string().nullable(),
  lastName: z.string(),
  gender: z.enum(["M", "F", "X"]).nullable(),
  jobTitle: z.string().nullable(),
  relation: z.string().nullable(),
  preferredLanguage: z.string().nullable(),
  preferredCurrency: z.string().nullable(),
  ownerId: z.string().nullable(),
  status: z.string(),
  source: z.string().nullable(),
  sourceRef: z.string().nullable(),
  tags: z.array(z.string()),
  dateOfBirth: z.string().nullable(),
  notes: z.string().nullable(),
  // Encrypted PII slots (canonical store; documents live in /documents)
  accessibilityEncrypted: kmsEnvelopeRecordSchema.optional(),
  dietaryEncrypted: kmsEnvelopeRecordSchema.optional(),
  loyaltyEncrypted: kmsEnvelopeRecordSchema.optional(),
  insuranceEncrypted: kmsEnvelopeRecordSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  // Hydrated identity fields
  email: z.string().nullable(),
  phone: z.string().nullable(),
  website: z.string().nullable(),
})

export type PersonRecord = z.infer<typeof personRecordSchema>

export const organizationRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  legalName: z.string().nullable(),
  website: z.string().nullable(),
  vatNumber: z.string().nullable(),
  industry: z.string().nullable(),
  relation: z.string().nullable(),
  ownerId: z.string().nullable(),
  defaultCurrency: z.string().nullable(),
  preferredLanguage: z.string().nullable(),
  paymentTerms: z.number().int().nullable(),
  status: z.string(),
  source: z.string().nullable(),
  sourceRef: z.string().nullable(),
  tags: z.array(z.string()),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type OrganizationRecord = z.infer<typeof organizationRecordSchema>

export const personListResponse = paginatedEnvelope(personRecordSchema)
export const personSingleResponse = singleEnvelope(personRecordSchema)
export const organizationListResponse = paginatedEnvelope(organizationRecordSchema)
export const organizationSingleResponse = singleEnvelope(organizationRecordSchema)

/**
 * Opportunity, pipeline, stage, activity, quote schemas — mirror the Drizzle
 * tables in `packages/crm/src/schema.ts`. Timestamps surface as ISO strings
 * after JSON serialization.
 */

export const opportunityRecordSchema = z.object({
  id: z.string(),
  title: z.string(),
  personId: z.string().nullable(),
  organizationId: z.string().nullable(),
  pipelineId: z.string(),
  stageId: z.string(),
  ownerId: z.string().nullable(),
  status: z.string(),
  valueAmountCents: z.number().int().nullable(),
  valueCurrency: z.string().nullable(),
  expectedCloseDate: z.string().nullable(),
  source: z.string().nullable(),
  sourceRef: z.string().nullable(),
  lostReason: z.string().nullable(),
  tags: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
  stageChangedAt: z.string(),
  closedAt: z.string().nullable(),
})

export type OpportunityRecord = z.infer<typeof opportunityRecordSchema>

export const opportunityListResponse = paginatedEnvelope(opportunityRecordSchema)
export const opportunitySingleResponse = singleEnvelope(opportunityRecordSchema)

export const pipelineRecordSchema = z.object({
  id: z.string(),
  entityType: z.string(),
  name: z.string(),
  isDefault: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type PipelineRecord = z.infer<typeof pipelineRecordSchema>

export const pipelineListResponse = paginatedEnvelope(pipelineRecordSchema)
export const pipelineSingleResponse = singleEnvelope(pipelineRecordSchema)

export const stageRecordSchema = z.object({
  id: z.string(),
  pipelineId: z.string(),
  name: z.string(),
  sortOrder: z.number().int(),
  probability: z.number().int().nullable(),
  isClosed: z.boolean(),
  isWon: z.boolean(),
  isLost: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type StageRecord = z.infer<typeof stageRecordSchema>

export const stageListResponse = paginatedEnvelope(stageRecordSchema)
export const stageSingleResponse = singleEnvelope(stageRecordSchema)

export const activityRecordSchema = z.object({
  id: z.string(),
  subject: z.string(),
  type: z.string(),
  ownerId: z.string().nullable(),
  status: z.string(),
  dueAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  location: z.string().nullable(),
  description: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type ActivityRecord = z.infer<typeof activityRecordSchema>

export const activityListResponse = paginatedEnvelope(activityRecordSchema)
export const activitySingleResponse = singleEnvelope(activityRecordSchema)

export const activityLinkRecordSchema = z.object({
  id: z.string(),
  activityId: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  role: z.string(),
  createdAt: z.string(),
})

export type ActivityLinkRecord = z.infer<typeof activityLinkRecordSchema>

export const activityLinkListResponse = listEnvelope(activityLinkRecordSchema)
export const activityLinkSingleResponse = singleEnvelope(activityLinkRecordSchema)

export const personNoteRecordSchema = z.object({
  id: z.string(),
  personId: z.string(),
  authorId: z.string(),
  content: z.string(),
  createdAt: z.string(),
})

export type PersonNoteRecord = z.infer<typeof personNoteRecordSchema>

export const personNoteListResponse = listEnvelope(personNoteRecordSchema)

export const personDocumentTypeSchema = z.enum([
  "passport",
  "id_card",
  "driver_license",
  "visa",
  "other",
])

export type PersonDocumentType = z.infer<typeof personDocumentTypeSchema>

export const personDocumentRecordSchema = z.object({
  id: z.string(),
  personId: z.string(),
  type: personDocumentTypeSchema,
  numberEncrypted: kmsEnvelopeRecordSchema.optional(),
  issuingAuthority: z.string().nullable(),
  issuingCountry: z.string().nullable(),
  issueDate: z.string().nullable(),
  expiryDate: z.string().nullable(),
  attachmentId: z.string().nullable(),
  isPrimary: z.boolean(),
  notes: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type PersonDocumentRecord = z.infer<typeof personDocumentRecordSchema>

export const personDocumentListResponse = listEnvelope(personDocumentRecordSchema)
export const personDocumentSingleResponse = singleEnvelope(personDocumentRecordSchema)

export const personDocumentRevealSchema = z.object({
  documentId: z.string(),
  number: z.string().nullable(),
})
export type PersonDocumentReveal = z.infer<typeof personDocumentRevealSchema>
export const personDocumentRevealResponse = singleEnvelope(personDocumentRevealSchema)

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

export type CustomerSignalKind = z.infer<typeof customerSignalKindSchema>
export type CustomerSignalSource = z.infer<typeof customerSignalSourceSchema>
export type CustomerSignalStatus = z.infer<typeof customerSignalStatusSchema>

export const customerSignalRecordSchema = z.object({
  id: z.string(),
  personId: z.string(),
  productId: z.string().nullable(),
  optionUnitId: z.string().nullable(),
  kind: customerSignalKindSchema,
  source: customerSignalSourceSchema,
  status: customerSignalStatusSchema,
  priority: z.string(),
  notes: z.string().nullable(),
  tags: z.array(z.string()),
  assignedToUserId: z.string().nullable(),
  followUpAt: z.string().nullable(),
  resolvedBookingId: z.string().nullable(),
  sourceSubmissionId: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type CustomerSignalRecord = z.infer<typeof customerSignalRecordSchema>

export const customerSignalListResponse = paginatedEnvelope(customerSignalRecordSchema)
export const customerSignalListByPersonResponse = listEnvelope(customerSignalRecordSchema)
export const customerSignalSingleResponse = singleEnvelope(customerSignalRecordSchema)

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

export type PersonRelationshipKind = z.infer<typeof personRelationshipKindSchema>

export const personRelationshipRecordSchema = z.object({
  id: z.string(),
  fromPersonId: z.string(),
  toPersonId: z.string(),
  kind: personRelationshipKindSchema,
  inverseKind: personRelationshipKindSchema.nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  isPrimary: z.boolean(),
  notes: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type PersonRelationshipRecord = z.infer<typeof personRelationshipRecordSchema>

export const personRelationshipListResponse = listEnvelope(personRelationshipRecordSchema)
export const personRelationshipSingleResponse = singleEnvelope(personRelationshipRecordSchema)

export const personTravelSnapshotSchema = z.object({
  dateOfBirth: z.string().nullable(),
  dietaryRequirements: z.string().nullable(),
  accessibilityNeeds: z.string().nullable(),
  passportNumber: z.string().nullable(),
  passportExpiry: z.string().nullable(),
  passportIssuingCountry: z.string().nullable(),
  passportIssuingAuthority: z.string().nullable(),
  passportPersonDocumentId: z.string().nullable(),
})

export type PersonTravelSnapshotRecord = z.infer<typeof personTravelSnapshotSchema>
export const personTravelSnapshotResponse = z.object({ data: personTravelSnapshotSchema })

export const quoteRecordSchema = z.object({
  id: z.string(),
  opportunityId: z.string(),
  status: z.string(),
  validUntil: z.string().nullable(),
  currency: z.string(),
  subtotalAmountCents: z.number().int(),
  taxAmountCents: z.number().int(),
  totalAmountCents: z.number().int(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  archivedAt: z.string().nullable(),
})

export type QuoteRecord = z.infer<typeof quoteRecordSchema>

export const quoteListResponse = paginatedEnvelope(quoteRecordSchema)
export const quoteSingleResponse = singleEnvelope(quoteRecordSchema)

export const quoteLineRecordSchema = z.object({
  id: z.string(),
  quoteId: z.string(),
  productId: z.string().nullable(),
  supplierServiceId: z.string().nullable(),
  description: z.string(),
  quantity: z.number().int(),
  unitPriceAmountCents: z.number().int(),
  totalAmountCents: z.number().int(),
  currency: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type QuoteLineRecord = z.infer<typeof quoteLineRecordSchema>

export const quoteLineListResponse = listEnvelope(quoteLineRecordSchema)
export const quoteLineSingleResponse = singleEnvelope(quoteLineRecordSchema)
