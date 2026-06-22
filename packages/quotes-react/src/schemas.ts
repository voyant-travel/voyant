import { listResponseSchema } from "@voyant-travel/types"
import { z } from "zod"

export const paginatedEnvelope = listResponseSchema

export const singleEnvelope = <T extends z.ZodTypeAny>(item: T) => z.object({ data: item })

export const listEnvelope = <T extends z.ZodTypeAny>(item: T) => z.object({ data: z.array(item) })

export const successEnvelope = z.object({ success: z.boolean() })

export const quoteRecordSchema = z.object({
  id: z.string(),
  title: z.string(),
  personId: z.string().nullable(),
  organizationId: z.string().nullable(),
  pipelineId: z.string(),
  stageId: z.string(),
  ownerId: z.string().nullable(),
  status: z.string(),
  acceptedVersionId: z.string().nullable(),
  valueAmountCents: z.number().int().nullable(),
  valueCurrency: z.string().nullable(),
  paxCount: z.number().int().nullable(),
  description: z.string().nullable(),
  expectedCloseDate: z.string().nullable(),
  source: z.string().nullable(),
  sourceRef: z.string().nullable(),
  lostReason: z.string().nullable(),
  tags: z.array(z.string()),
  createdBy: z.string().nullable(),
  updatedBy: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  stageChangedAt: z.string(),
  closedAt: z.string().nullable(),
})

export type QuoteRecord = z.infer<typeof quoteRecordSchema>

export const quoteListResponse = paginatedEnvelope(quoteRecordSchema)
export const quoteSingleResponse = singleEnvelope(quoteRecordSchema)

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

export const quoteVersionRecordSchema = z.object({
  id: z.string(),
  quoteId: z.string(),
  label: z.string().nullable(),
  status: z.string(),
  supersedesId: z.string().nullable(),
  tripSnapshotId: z.string().nullable(),
  validUntil: z.string().nullable(),
  currency: z.string(),
  subtotalAmountCents: z.number().int(),
  taxAmountCents: z.number().int(),
  totalAmountCents: z.number().int(),
  notes: z.string().nullable(),
  sentAt: z.string().nullable(),
  viewedAt: z.string().nullable(),
  decidedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  archivedAt: z.string().nullable(),
})

export type QuoteVersionRecord = z.infer<typeof quoteVersionRecordSchema>

export const quoteVersionListResponse = paginatedEnvelope(quoteVersionRecordSchema)
export const quoteVersionSingleResponse = singleEnvelope(quoteVersionRecordSchema)
export const acceptQuoteVersionResponse = singleEnvelope(
  z.object({
    quote: quoteRecordSchema,
    quoteVersion: quoteVersionRecordSchema,
    closedQuoteVersions: z.array(quoteVersionRecordSchema),
  }),
)

export const quoteVersionLineRecordSchema = z.object({
  id: z.string(),
  quoteVersionId: z.string(),
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

export type QuoteVersionLineRecord = z.infer<typeof quoteVersionLineRecordSchema>

export const quoteVersionLineListResponse = listEnvelope(quoteVersionLineRecordSchema)
export const quoteVersionLineSingleResponse = singleEnvelope(quoteVersionLineRecordSchema)

export const quoteParticipantRecordSchema = z.object({
  id: z.string(),
  quoteId: z.string(),
  personId: z.string(),
  role: z.string(),
  isPrimary: z.boolean(),
  createdAt: z.string(),
})

export type QuoteParticipantRecord = z.infer<typeof quoteParticipantRecordSchema>

export const quoteParticipantListResponse = listEnvelope(quoteParticipantRecordSchema)
export const quoteParticipantSingleResponse = singleEnvelope(quoteParticipantRecordSchema)

export const quoteProductRecordSchema = z.object({
  id: z.string(),
  quoteId: z.string(),
  productId: z.string().nullable(),
  supplierServiceId: z.string().nullable(),
  nameSnapshot: z.string(),
  description: z.string().nullable(),
  quantity: z.number().int(),
  unitPriceAmountCents: z.number().int().nullable(),
  costAmountCents: z.number().int().nullable(),
  currency: z.string().nullable(),
  discountAmountCents: z.number().int().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type QuoteProductRecord = z.infer<typeof quoteProductRecordSchema>

export const quoteProductListResponse = listEnvelope(quoteProductRecordSchema)
export const quoteProductSingleResponse = singleEnvelope(quoteProductRecordSchema)

export const quoteMediaRecordSchema = z.object({
  id: z.string(),
  quoteId: z.string(),
  mediaType: z.string(),
  name: z.string(),
  url: z.string(),
  storageKey: z.string().nullable(),
  mimeType: z.string().nullable(),
  fileSize: z.number().int().nullable(),
  altText: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type QuoteMediaRecord = z.infer<typeof quoteMediaRecordSchema>

export const quoteMediaListResponse = listEnvelope(quoteMediaRecordSchema)
export const quoteMediaSingleResponse = singleEnvelope(quoteMediaRecordSchema)
