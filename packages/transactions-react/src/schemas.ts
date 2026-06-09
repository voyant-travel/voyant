import { insertOfferSchema, insertOrderSchema, offerMetadataSchema } from "@voyantjs/transactions"
import { z } from "zod"

export const paginatedEnvelope = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    data: z.array(item),
    total: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
  })

export const singleEnvelope = <T extends z.ZodTypeAny>(item: T) => z.object({ data: item })
export const successEnvelope = z.object({ success: z.boolean() })

export const offerRecordSchema = insertOfferSchema.extend({
  id: z.string(),
  personId: z.string().nullable(),
  organizationId: z.string().nullable(),
  quoteId: z.string().nullable(),
  quoteVersionId: z.string().nullable(),
  marketId: z.string().nullable(),
  sourceChannelId: z.string().nullable(),
  baseCurrency: z.string().nullable(),
  fxRateSetId: z.string().nullable(),
  subtotalAmountCents: z.number().int(),
  taxAmountCents: z.number().int(),
  feeAmountCents: z.number().int(),
  totalAmountCents: z.number().int(),
  costAmountCents: z.number().int(),
  validFrom: z.string().nullable(),
  validUntil: z.string().nullable(),
  sentAt: z.string().nullable(),
  acceptedAt: z.string().nullable(),
  convertedAt: z.string().nullable(),
  notes: z.string().nullable(),
  metadata: offerMetadataSchema.nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type OfferRecord = z.infer<typeof offerRecordSchema>
export type OfferMetadataRecord = z.infer<typeof offerMetadataSchema>

export const orderRecordSchema = insertOrderSchema.extend({
  id: z.string(),
  offerId: z.string().nullable(),
  personId: z.string().nullable(),
  organizationId: z.string().nullable(),
  quoteId: z.string().nullable(),
  quoteVersionId: z.string().nullable(),
  marketId: z.string().nullable(),
  sourceChannelId: z.string().nullable(),
  baseCurrency: z.string().nullable(),
  fxRateSetId: z.string().nullable(),
  subtotalAmountCents: z.number().int(),
  taxAmountCents: z.number().int(),
  feeAmountCents: z.number().int(),
  totalAmountCents: z.number().int(),
  costAmountCents: z.number().int(),
  orderedAt: z.string().nullable(),
  confirmedAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  notes: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type OrderRecord = z.infer<typeof orderRecordSchema>

export const offerListResponse = paginatedEnvelope(offerRecordSchema)
export const offerSingleResponse = singleEnvelope(offerRecordSchema)
export const orderListResponse = paginatedEnvelope(orderRecordSchema)
export const orderSingleResponse = singleEnvelope(orderRecordSchema)
