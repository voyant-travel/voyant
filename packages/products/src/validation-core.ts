import {
  booleanQueryParam,
  optionUnitTypeSchema,
  productBookingModeSchema,
  productCapacityModeSchema,
  productOptionStatusSchema,
  productStatusSchema,
  productVisibilitySchema,
  typeIdSchema,
  z,
} from "./validation-shared.js"

const productCoreSchema = z.object({
  name: z.string().min(1).max(255),
  status: productStatusSchema.default("draft"),
  description: z.string().optional().nullable(),
  bookingMode: productBookingModeSchema.default("date"),
  capacityMode: productCapacityModeSchema.default("limited"),
  timezone: z.string().max(100).optional().nullable(),
  visibility: productVisibilitySchema.default("private"),
  activated: z.boolean().default(false),
  reservationTimeoutMinutes: z.number().int().min(0).optional().nullable(),
  sellCurrency: z.string().min(3).max(3),
  facilityId: z.string().optional().nullable(),
  productTypeId: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  pax: z.number().int().positive().optional().nullable(),
  tags: z.array(z.string()).default([]),
})

const productPricingFields = {
  sellAmountCents: z.number().int().min(0).optional().nullable(),
  costAmountCents: z.number().int().min(0).optional().nullable(),
  marginPercent: z.number().int().optional().nullable(),
}

export const insertProductSchema = productCoreSchema.extend(productPricingFields)
export const updateProductSchema = productCoreSchema.partial().extend(productPricingFields)
export const selectProductSchema = productCoreSchema.extend({
  id: typeIdSchema("products"),
  sellAmountCents: z.number().int().nullable(),
  costAmountCents: z.number().int().nullable(),
  marginPercent: z.number().int().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})
export const productListQuerySchema = z.object({
  status: productStatusSchema.optional(),
  bookingMode: productBookingModeSchema.optional(),
  visibility: productVisibilitySchema.optional(),
  activated: booleanQueryParam.optional(),
  facilityId: z.string().optional(),
  productTypeId: z.string().optional(),
  categoryId: z.string().optional(),
  tag: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export const productAggregatesQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
})
export type InsertProduct = z.infer<typeof insertProductSchema>
export type UpdateProduct = z.infer<typeof updateProductSchema>
export type SelectProduct = z.infer<typeof selectProductSchema>

const productOptionCoreSchema = z.object({
  name: z.string().min(1).max(255),
  code: z.string().max(100).optional().nullable(),
  description: z.string().optional().nullable(),
  status: productOptionStatusSchema.default("draft"),
  isDefault: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  availableFrom: z.string().optional().nullable(),
  availableTo: z.string().optional().nullable(),
})
export const insertProductOptionSchema = productOptionCoreSchema
export const updateProductOptionSchema = productOptionCoreSchema.partial()
export const productOptionListQuerySchema = z.object({
  productId: z.string().optional(),
  status: productOptionStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})
export type InsertProductOption = z.infer<typeof insertProductOptionSchema>
export type UpdateProductOption = z.infer<typeof updateProductOptionSchema>

const optionUnitCoreSchema = z.object({
  name: z.string().min(1).max(255),
  code: z.string().max(100).optional().nullable(),
  description: z.string().optional().nullable(),
  unitType: optionUnitTypeSchema.default("person"),
  minQuantity: z.number().int().min(0).optional().nullable(),
  maxQuantity: z.number().int().min(0).optional().nullable(),
  minAge: z.number().int().min(0).optional().nullable(),
  maxAge: z.number().int().min(0).optional().nullable(),
  occupancyMin: z.number().int().min(0).optional().nullable(),
  occupancyMax: z.number().int().min(0).optional().nullable(),
  isRequired: z.boolean().default(false),
  isHidden: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
})
export const insertOptionUnitSchema = optionUnitCoreSchema
export const updateOptionUnitSchema = optionUnitCoreSchema.partial()
export const optionUnitListQuerySchema = z.object({
  optionId: z.string().optional(),
  unitType: optionUnitTypeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})
export type InsertOptionUnit = z.infer<typeof insertOptionUnitSchema>
export type UpdateOptionUnit = z.infer<typeof updateOptionUnitSchema>

export const insertVersionSchema = z.object({
  notes: z.string().max(10000).optional().nullable(),
})
export type InsertVersion = z.infer<typeof insertVersionSchema>

export const insertProductNoteSchema = z.object({
  content: z.string().min(1).max(10000),
})
