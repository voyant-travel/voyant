import {
  currencyCodeSchema,
  externalRefsSchema,
  isoDateSchema,
  moneyStringSchema,
  priceAvailabilitySchema,
  priceComponentDirectionSchema,
  priceComponentKindSchema,
  priceFareVariantSchema,
  z,
} from "./validation-shared.js"

const priceCoreSchema = z.object({
  sailingId: z.string(),
  cabinCategoryId: z.string(),
  occupancy: z.number().int().min(1).max(8),
  fareCode: z.string().optional().nullable(),
  fareCodeName: z.string().optional().nullable(),
  fareVariant: priceFareVariantSchema.default("cruise_only"),
  currency: currencyCodeSchema,
  pricePerPerson: moneyStringSchema,
  originalPricePerPerson: moneyStringSchema.optional().nullable(),
  secondGuestPricePerPerson: moneyStringSchema.optional().nullable(),
  singlePricePerPerson: moneyStringSchema.optional().nullable(),
  singleSupplementPercent: z.string().optional().nullable(),
  availability: priceAvailabilitySchema.default("available"),
  availabilityCount: z.number().int().nonnegative().optional().nullable(),
  priceCatalogId: z.string().optional().nullable(),
  priceScheduleId: z.string().optional().nullable(),
  bookingDeadline: isoDateSchema.optional().nullable(),
  earlyBookingDeadline: isoDateSchema.optional().nullable(),
  earlyBookingBonusDescription: z.string().optional().nullable(),
  requiresRequest: z.boolean().default(false),
  notes: z.string().optional().nullable(),
  externalRefs: externalRefsSchema,
})

export const insertPriceSchema = priceCoreSchema
export const updatePriceSchema = priceCoreSchema.partial()

export const priceListQuerySchema = z.object({
  sailingId: z.string().optional(),
  cabinCategoryId: z.string().optional(),
  occupancy: z.coerce.number().int().min(1).max(8).optional(),
  fareCode: z.string().optional(),
  fareVariant: priceFareVariantSchema.optional(),
  availability: priceAvailabilitySchema.optional(),
  priceCatalogId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
})

export type InsertPrice = z.infer<typeof insertPriceSchema>
export type UpdatePrice = z.infer<typeof updatePriceSchema>
export type PriceListQuery = z.infer<typeof priceListQuerySchema>

const priceComponentCoreSchema = z.object({
  priceId: z.string(),
  kind: priceComponentKindSchema,
  label: z.string().optional().nullable(),
  amount: moneyStringSchema,
  currency: currencyCodeSchema,
  direction: priceComponentDirectionSchema,
  perPerson: z.boolean().default(true),
})

export const insertPriceComponentSchema = priceComponentCoreSchema
export const updatePriceComponentSchema = priceComponentCoreSchema.partial()

export type InsertPriceComponent = z.infer<typeof insertPriceComponentSchema>
export type UpdatePriceComponent = z.infer<typeof updatePriceComponentSchema>
