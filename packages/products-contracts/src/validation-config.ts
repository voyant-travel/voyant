import {
  booleanQueryParam,
  productActivationModeSchema,
  productCapabilitySchema,
  productDeliveryFormatSchema,
  productTicketFulfillmentSchema,
  z,
} from "./validation-shared.js"

const activationSettingsCoreSchema = z.object({
  activationMode: productActivationModeSchema.default("manual"),
  activateAt: z.string().datetime().optional().nullable(),
  deactivateAt: z.string().datetime().optional().nullable(),
  sellAt: z.string().datetime().optional().nullable(),
  stopSellAt: z.string().datetime().optional().nullable(),
})
const ticketSettingsCoreSchema = z.object({
  fulfillmentMode: productTicketFulfillmentSchema.default("none"),
  defaultDeliveryFormat: productDeliveryFormatSchema.default("none"),
  ticketPerUnit: z.boolean().default(false),
  barcodeFormat: z.string().max(100).optional().nullable(),
  voucherMessage: z.string().optional().nullable(),
  ticketMessage: z.string().optional().nullable(),
})
const visibilitySettingsCoreSchema = z.object({
  isSearchable: z.boolean().default(false),
  isBookable: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  requiresAuthentication: z.boolean().default(false),
})
const capabilityCoreSchema = z.object({
  capability: productCapabilitySchema,
  enabled: z.boolean().default(true),
  notes: z.string().optional().nullable(),
})
const deliveryFormatCoreSchema = z.object({
  format: productDeliveryFormatSchema,
  isDefault: z.boolean().default(false),
})

export const insertProductActivationSettingSchema = activationSettingsCoreSchema
export const updateProductActivationSettingSchema = activationSettingsCoreSchema.partial()
export const productActivationSettingListQuerySchema = z.object({
  productId: z.string().optional(),
  activationMode: productActivationModeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})
export const insertProductTicketSettingSchema = ticketSettingsCoreSchema
export const updateProductTicketSettingSchema = ticketSettingsCoreSchema.partial()
export const productTicketSettingListQuerySchema = z.object({
  productId: z.string().optional(),
  fulfillmentMode: productTicketFulfillmentSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})
export const insertProductVisibilitySettingSchema = visibilitySettingsCoreSchema
export const updateProductVisibilitySettingSchema = visibilitySettingsCoreSchema.partial()
export const productVisibilitySettingListQuerySchema = z.object({
  productId: z.string().optional(),
  isSearchable: booleanQueryParam.optional(),
  isBookable: booleanQueryParam.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})
export const insertProductCapabilitySchema = capabilityCoreSchema
export const updateProductCapabilitySchema = capabilityCoreSchema.partial()
export const productCapabilityListQuerySchema = z.object({
  productId: z.string().optional(),
  capability: productCapabilitySchema.optional(),
  enabled: booleanQueryParam.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})
export const insertProductDeliveryFormatSchema = deliveryFormatCoreSchema
export const updateProductDeliveryFormatSchema = deliveryFormatCoreSchema.partial()
export const productDeliveryFormatListQuerySchema = z.object({
  productId: z.string().optional(),
  format: productDeliveryFormatSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export type InsertProductActivationSetting = z.infer<typeof insertProductActivationSettingSchema>
export type UpdateProductActivationSetting = z.infer<typeof updateProductActivationSettingSchema>
export type InsertProductTicketSetting = z.infer<typeof insertProductTicketSettingSchema>
export type UpdateProductTicketSetting = z.infer<typeof updateProductTicketSettingSchema>
export type InsertProductVisibilitySetting = z.infer<typeof insertProductVisibilitySettingSchema>
export type UpdateProductVisibilitySetting = z.infer<typeof updateProductVisibilitySettingSchema>
export type InsertProductCapability = z.infer<typeof insertProductCapabilitySchema>
export type UpdateProductCapability = z.infer<typeof updateProductCapabilitySchema>
export type InsertProductDeliveryFormat = z.infer<typeof insertProductDeliveryFormatSchema>
export type UpdateProductDeliveryFormat = z.infer<typeof updateProductDeliveryFormatSchema>
