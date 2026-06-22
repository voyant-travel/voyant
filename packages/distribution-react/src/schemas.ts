import { listResponseSchema } from "@voyant-travel/types"
import { z } from "zod"

export const paginatedEnvelope = listResponseSchema

export const singleEnvelope = <T extends z.ZodTypeAny>(item: T) => z.object({ data: item })
export const successEnvelope = z.object({ success: z.boolean() })

export const supplierOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
})

export type SupplierOption = z.infer<typeof supplierOptionSchema>

export const productOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
})

export type ProductOption = z.infer<typeof productOptionSchema>

export const bookingOptionSchema = z.object({
  id: z.string(),
  bookingNumber: z.string(),
})

export type BookingOption = z.infer<typeof bookingOptionSchema>

export const channelKindSchema = z.enum([
  "direct",
  "affiliate",
  "ota",
  "reseller",
  "marketplace",
  "api_partner",
  "connect",
])

export const channelStatusSchema = z.enum(["active", "inactive", "pending", "archived"])
export const contractStatusSchema = z.enum(["draft", "active", "expired", "terminated"])
export const paymentOwnerSchema = z.enum(["operator", "channel", "split"])
export const cancellationOwnerSchema = z.enum(["operator", "channel", "mixed"])
export const commissionScopeSchema = z.enum(["booking", "product", "rate", "category"])
export const commissionTypeSchema = z.enum(["fixed", "percentage"])
export const webhookStatusSchema = z.enum(["pending", "processed", "failed", "ignored"])

export const channelRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: channelKindSchema,
  status: channelStatusSchema,
  website: z.string().nullable(),
  contactName: z.string().nullable(),
  contactEmail: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
})

export type ChannelRow = z.infer<typeof channelRecordSchema>

export const channelDetailSchema = channelRecordSchema.extend({
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type ChannelDetail = z.infer<typeof channelDetailSchema>

export const channelContractRecordSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  supplierId: z.string().nullable(),
  status: contractStatusSchema,
  startsAt: z.string(),
  endsAt: z.string().nullable(),
  paymentOwner: paymentOwnerSchema,
  cancellationOwner: cancellationOwnerSchema,
  settlementTerms: z.string().nullable(),
  notes: z.string().nullable(),
})

export type ChannelContractRow = z.infer<typeof channelContractRecordSchema>

export const channelContractDetailSchema = channelContractRecordSchema.extend({
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type ChannelContractDetail = z.infer<typeof channelContractDetailSchema>

export const channelCommissionRuleRecordSchema = z.object({
  id: z.string(),
  contractId: z.string(),
  scope: commissionScopeSchema,
  productId: z.string().nullable(),
  externalRateId: z.string().nullable(),
  externalCategoryId: z.string().nullable(),
  commissionType: commissionTypeSchema,
  amountCents: z.number().int().nullable(),
  percentBasisPoints: z.number().int().nullable(),
  validFrom: z.string().nullable(),
  validTo: z.string().nullable(),
})

export type ChannelCommissionRuleRow = z.infer<typeof channelCommissionRuleRecordSchema>

export const channelCommissionRuleDetailSchema = channelCommissionRuleRecordSchema.extend({
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type ChannelCommissionRuleDetail = z.infer<typeof channelCommissionRuleDetailSchema>

export const channelProductMappingRecordSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  productId: z.string(),
  externalProductId: z.string(),
  externalRateId: z.string().nullable(),
  externalCategoryId: z.string().nullable(),
  active: z.boolean(),
})

export type ChannelProductMappingRow = z.infer<typeof channelProductMappingRecordSchema>

export const channelProductMappingDetailSchema = channelProductMappingRecordSchema.extend({
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type ChannelProductMappingDetail = z.infer<typeof channelProductMappingDetailSchema>

export const channelBookingLinkRecordSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  bookingId: z.string(),
  externalBookingId: z.string().nullable(),
  externalReference: z.string().nullable(),
  externalStatus: z.string().nullable(),
  bookedAtExternal: z.string().nullable(),
  lastSyncedAt: z.string().nullable(),
})

export type ChannelBookingLinkRow = z.infer<typeof channelBookingLinkRecordSchema>

export const channelBookingLinkDetailSchema = channelBookingLinkRecordSchema.extend({
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type ChannelBookingLinkDetail = z.infer<typeof channelBookingLinkDetailSchema>

export const channelWebhookEventRecordSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  eventType: z.string(),
  externalEventId: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()),
  receivedAt: z.string().nullable(),
  processedAt: z.string().nullable(),
  status: webhookStatusSchema,
  errorMessage: z.string().nullable(),
})

export type ChannelWebhookEventRow = z.infer<typeof channelWebhookEventRecordSchema>

export const channelWebhookEventDetailSchema = channelWebhookEventRecordSchema.extend({
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type ChannelWebhookEventDetail = z.infer<typeof channelWebhookEventDetailSchema>

export const supplierListResponse = paginatedEnvelope(supplierOptionSchema)
export const productListResponse = paginatedEnvelope(productOptionSchema)
export const bookingListResponse = paginatedEnvelope(bookingOptionSchema)
export const channelListResponse = paginatedEnvelope(channelRecordSchema)
export const channelContractListResponse = paginatedEnvelope(channelContractRecordSchema)
export const channelCommissionRuleListResponse = paginatedEnvelope(
  channelCommissionRuleRecordSchema,
)
export const channelProductMappingListResponse = paginatedEnvelope(
  channelProductMappingRecordSchema,
)
export const channelBookingLinkListResponse = paginatedEnvelope(channelBookingLinkRecordSchema)
export const channelWebhookEventListResponse = paginatedEnvelope(channelWebhookEventRecordSchema)
export const supplierSingleResponse = singleEnvelope(supplierOptionSchema)
export const productSingleResponse = singleEnvelope(productOptionSchema)
export const bookingSingleResponse = singleEnvelope(bookingOptionSchema)
export const channelSingleResponse = singleEnvelope(channelDetailSchema)
export const channelContractSingleResponse = singleEnvelope(channelContractDetailSchema)
export const channelCommissionRuleSingleResponse = singleEnvelope(channelCommissionRuleDetailSchema)
export const channelProductMappingSingleResponse = singleEnvelope(channelProductMappingDetailSchema)
export const channelBookingLinkSingleResponse = singleEnvelope(channelBookingLinkDetailSchema)
export const channelWebhookEventSingleResponse = singleEnvelope(channelWebhookEventDetailSchema)
