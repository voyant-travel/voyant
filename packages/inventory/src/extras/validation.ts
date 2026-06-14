import { booleanQueryParam } from "@voyantjs/db/helpers"
import { z } from "zod"

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

const moneySchema = z.number().int().min(0).nullable().optional()

export const extraSelectionTypeSchema = z.enum([
  "optional",
  "required",
  "default_selected",
  "unavailable",
])

export const extraPricingModeSchema = z.enum([
  "included",
  "per_person",
  "per_booking",
  "quantity_based",
  "on_request",
  "free",
])

export const bookingExtraStatusSchema = z.enum([
  "draft",
  "selected",
  "confirmed",
  "cancelled",
  "fulfilled",
])

export const extraCollectionModeSchema = z.enum([
  "booking_total",
  "cash_on_trip",
  "external",
  "included",
  "none",
])

export const extraParticipantSelectionStatusSchema = z.enum([
  "selected",
  "cancelled",
  "fulfilled",
  "no_show",
])

export const extraCollectionStatusSchema = z.enum([
  "not_required",
  "pending",
  "collected",
  "waived",
  "refunded",
])

export const productExtraCoreSchema = z.object({
  productId: z.string(),
  supplierId: z.string().nullable().optional(),
  code: z.string().max(100).nullable().optional(),
  name: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  selectionType: extraSelectionTypeSchema.default("optional"),
  pricingMode: extraPricingModeSchema.default("per_booking"),
  pricedPerPerson: z.boolean().default(false),
  collectionMode: extraCollectionModeSchema.default("booking_total"),
  showOnSlotManifest: z.boolean().default(true),
  minQuantity: z.number().int().min(0).nullable().optional(),
  maxQuantity: z.number().int().min(0).nullable().optional(),
  defaultQuantity: z.number().int().min(0).nullable().optional(),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

export const insertProductExtraSchema = productExtraCoreSchema
export const updateProductExtraSchema = productExtraCoreSchema.partial()
export const productExtraListQuerySchema = paginationSchema.extend({
  productId: z.string().optional(),
  supplierId: z.string().optional(),
  active: booleanQueryParam.optional(),
  search: z.string().optional(),
})

export const optionExtraConfigCoreSchema = z.object({
  optionId: z.string(),
  productExtraId: z.string(),
  selectionType: extraSelectionTypeSchema.nullable().optional(),
  pricingMode: extraPricingModeSchema.nullable().optional(),
  pricedPerPerson: z.boolean().nullable().optional(),
  minQuantity: z.number().int().min(0).nullable().optional(),
  maxQuantity: z.number().int().min(0).nullable().optional(),
  defaultQuantity: z.number().int().min(0).nullable().optional(),
  isDefault: z.boolean().default(false),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  notes: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

export const insertOptionExtraConfigSchema = optionExtraConfigCoreSchema
export const updateOptionExtraConfigSchema = optionExtraConfigCoreSchema.partial()
export const optionExtraConfigListQuerySchema = paginationSchema.extend({
  optionId: z.string().optional(),
  productExtraId: z.string().optional(),
  active: booleanQueryParam.optional(),
})

export const bookingExtraCoreSchema = z.object({
  bookingId: z.string(),
  productExtraId: z.string().nullable().optional(),
  optionExtraConfigId: z.string().nullable().optional(),
  name: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  status: bookingExtraStatusSchema.default("draft"),
  pricingMode: extraPricingModeSchema.default("per_booking"),
  pricedPerPerson: z.boolean().default(false),
  quantity: z.number().int().min(1).default(1),
  sellCurrency: z.string().length(3),
  unitSellAmountCents: moneySchema,
  totalSellAmountCents: moneySchema,
  costCurrency: z.string().length(3).nullable().optional(),
  unitCostAmountCents: moneySchema,
  totalCostAmountCents: moneySchema,
  notes: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

export const insertBookingExtraSchema = bookingExtraCoreSchema
export const updateBookingExtraSchema = bookingExtraCoreSchema.partial()
export const bookingExtraListQuerySchema = paginationSchema.extend({
  bookingId: z.string().optional(),
  productExtraId: z.string().optional(),
  optionExtraConfigId: z.string().optional(),
  status: bookingExtraStatusSchema.optional(),
})

export const slotExtraManifestQuerySchema = z.object({
  includeInactiveExtras: booleanQueryParam.default(false),
})

export const slotExtraSelectionPatchSchema = z.object({
  bookingId: z.string().min(1),
  travelerId: z.string().min(1),
  productExtraId: z.string().min(1),
  optionExtraConfigId: z.string().nullable().optional(),
  status: extraParticipantSelectionStatusSchema.default("selected"),
  collectionStatus: extraCollectionStatusSchema.optional(),
  collectionCurrency: z.string().length(3).nullable().optional(),
  collectionAmountCents: moneySchema,
  notes: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

export const slotExtraSelectionBulkSchema = z.object({
  selections: z.array(slotExtraSelectionPatchSchema).min(1).max(500),
})

export const slotExtraCollectionBulkSchema = z.object({
  productExtraId: z.string().min(1),
  travelerIds: z.array(z.string().min(1)).min(1).max(500),
  collectionStatus: extraCollectionStatusSchema,
  collectionCurrency: z.string().length(3).nullable().optional(),
  collectionAmountCents: moneySchema,
  notes: z.string().nullable().optional(),
})
