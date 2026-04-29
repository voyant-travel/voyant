import {
  charterBookingModeSchema,
  charterStatusSchema,
  externalRefsSchema,
  isoDateSchema,
  percentStringSchema,
  pricesByCurrencySchema,
  slugSchema,
  voyageSalesStatusSchema,
  z,
} from "./validation-shared.js"

const productCoreSchema = z.object({
  slug: slugSchema,
  name: z.string().min(1).max(255),
  lineSupplierId: z.string().optional().nullable(),
  defaultYachtId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  shortDescription: z.string().optional().nullable(),
  heroImageUrl: z.string().url().optional().nullable(),
  mapImageUrl: z.string().url().optional().nullable(),
  regions: z.array(z.string()).default([]),
  themes: z.array(z.string()).default([]),
  status: charterStatusSchema.default("draft"),
  defaultBookingModes: z.array(charterBookingModeSchema).min(1).default(["per_suite"]),
  defaultMybaTemplateId: z.string().optional().nullable(),
  defaultApaPercent: percentStringSchema.optional().nullable(),
  externalRefs: externalRefsSchema,
})

export const insertProductSchema = productCoreSchema
export const updateProductSchema = productCoreSchema.partial()

export const productListQuerySchema = z.object({
  status: charterStatusSchema.optional(),
  lineSupplierId: z.string().optional(),
  region: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export type InsertProduct = z.infer<typeof insertProductSchema>
export type UpdateProduct = z.infer<typeof updateProductSchema>
export type ProductListQuery = z.infer<typeof productListQuerySchema>

const voyageCoreSchema = z.object({
  productId: z.string(),
  yachtId: z.string(),
  voyageCode: z.string().min(1).max(100),
  name: z.string().optional().nullable(),
  embarkPortFacilityId: z.string().optional().nullable(),
  embarkPortName: z.string().optional().nullable(),
  disembarkPortFacilityId: z.string().optional().nullable(),
  disembarkPortName: z.string().optional().nullable(),
  departureDate: isoDateSchema,
  returnDate: isoDateSchema,
  nights: z.number().int().positive(),
  bookingModes: z.array(charterBookingModeSchema).min(1).default(["per_suite"]),
  appointmentOnly: z.boolean().default(false),

  /**
   * Per-currency whole-yacht price map. Adding a new currency is a data
   * change, not a schema change.
   */
  wholeYachtPricesByCurrency: pricesByCurrencySchema.default({}),

  apaPercentOverride: percentStringSchema.optional().nullable(),
  mybaTemplateIdOverride: z.string().optional().nullable(),
  charterAreaOverride: z.string().optional().nullable(),

  salesStatus: voyageSalesStatusSchema.default("open"),
  availabilityNote: z.string().optional().nullable(),
  externalRefs: externalRefsSchema,
})

export const insertVoyageSchema = voyageCoreSchema
export const updateVoyageSchema = voyageCoreSchema.partial()

export const voyageListQuerySchema = z.object({
  productId: z.string().optional(),
  yachtId: z.string().optional(),
  dateFrom: isoDateSchema.optional(),
  dateTo: isoDateSchema.optional(),
  salesStatus: voyageSalesStatusSchema.optional(),
  bookingMode: charterBookingModeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export type InsertVoyage = z.infer<typeof insertVoyageSchema>
export type UpdateVoyage = z.infer<typeof updateVoyageSchema>
export type VoyageListQuery = z.infer<typeof voyageListQuerySchema>
