import {
  CABIN_ACCESSIBILITY_FEATURES,
  CABIN_BED_CONFIGURATIONS,
  CABIN_VIEW_TYPES,
  type CabinAccessibilityFeature,
  type CabinBedConfiguration,
  type CabinViewType,
} from "./cabin-features.js"
import {
  cabinRoomTypeSchema,
  externalRefsSchema,
  shipTypeSchema,
  slugSchema,
  z,
} from "./validation-shared.js"

export const cabinBedConfigurationSchema = z.enum(CABIN_BED_CONFIGURATIONS)
export const cabinAccessibilityFeatureSchema = z.enum(CABIN_ACCESSIBILITY_FEATURES)
export const cabinViewTypeSchema = z.enum(CABIN_VIEW_TYPES)

const shipCoreSchema = z.object({
  lineSupplierId: z.string().optional().nullable(),
  name: z.string().min(1).max(255),
  slug: slugSchema,
  shipType: shipTypeSchema,
  capacityGuests: z.number().int().nonnegative().optional().nullable(),
  capacityCrew: z.number().int().nonnegative().optional().nullable(),
  cabinCount: z.number().int().nonnegative().optional().nullable(),
  deckCount: z.number().int().nonnegative().optional().nullable(),
  lengthMeters: z.string().optional().nullable(),
  cruisingSpeedKnots: z.string().optional().nullable(),
  yearBuilt: z.number().int().optional().nullable(),
  yearRefurbished: z.number().int().optional().nullable(),
  imo: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  deckPlanUrl: z.string().url().optional().nullable(),
  gallery: z.array(z.string()).default([]),
  amenities: z.record(z.string(), z.unknown()).default({}),
  externalRefs: externalRefsSchema,
  isActive: z.boolean().default(true),
})

export const insertShipSchema = shipCoreSchema
export const updateShipSchema = shipCoreSchema.partial()

export const shipListQuerySchema = z.object({
  lineSupplierId: z.string().optional(),
  shipType: shipTypeSchema.optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export type InsertShip = z.infer<typeof insertShipSchema>
export type UpdateShip = z.infer<typeof updateShipSchema>
export type ShipListQuery = z.infer<typeof shipListQuerySchema>

const deckCoreSchema = z.object({
  shipId: z.string(),
  name: z.string().min(1).max(100),
  level: z.number().int().optional().nullable(),
  planImageUrl: z.string().url().optional().nullable(),
})

export const insertDeckSchema = deckCoreSchema
export const updateDeckSchema = deckCoreSchema.partial()

export type InsertDeck = z.infer<typeof insertDeckSchema>
export type UpdateDeck = z.infer<typeof updateDeckSchema>

const cabinCategoryCoreSchema = z.object({
  shipId: z.string(),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(255),
  roomType: cabinRoomTypeSchema,
  description: z.string().optional().nullable(),
  minOccupancy: z.number().int().min(1).default(1),
  maxOccupancy: z.number().int().min(1),
  squareFeet: z.string().optional().nullable(),
  wheelchairAccessible: z.boolean().default(false),
  amenities: z.array(z.string()).default([]),
  featureCodes: z.array(z.string()).default([]),
  bedConfigurations: z.array(cabinBedConfigurationSchema).default([]),
  accessibilityFeatures: z.array(cabinAccessibilityFeatureSchema).default([]),
  viewType: cabinViewTypeSchema.optional().nullable(),
  images: z.array(z.string()).default([]),
  floorplanImages: z.array(z.string()).default([]),
  gradeCodes: z.array(z.string()).default([]),
  externalRefs: externalRefsSchema,
})

export const insertCabinCategorySchema = cabinCategoryCoreSchema.refine(
  (v) => v.maxOccupancy >= v.minOccupancy,
  { message: "maxOccupancy must be >= minOccupancy" },
)
export const updateCabinCategorySchema = cabinCategoryCoreSchema.partial()

export type InsertCabinCategory = z.infer<typeof insertCabinCategorySchema>
export type UpdateCabinCategory = z.infer<typeof updateCabinCategorySchema>
export type { CabinAccessibilityFeature, CabinBedConfiguration, CabinViewType }

const cabinCoreSchema = z.object({
  categoryId: z.string(),
  cabinNumber: z.string().min(1).max(50),
  deckId: z.string().optional().nullable(),
  position: z.string().optional().nullable(),
  connectsTo: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
})

export const insertCabinSchema = cabinCoreSchema
export const updateCabinSchema = cabinCoreSchema.partial()

export type InsertCabin = z.infer<typeof insertCabinSchema>
export type UpdateCabin = z.infer<typeof updateCabinSchema>
