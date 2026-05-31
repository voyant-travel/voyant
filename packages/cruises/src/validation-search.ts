import {
  cruiseSourceSchema,
  cruiseTypeSchema,
  currencyCodeSchema,
  isoDateSchema,
  moneyStringSchema,
  slugSchema,
  z,
} from "./validation-shared.js"

const sourceRefSchema = z
  .object({
    connectionId: z.string().optional(),
    externalId: z.string().optional(),
  })
  .catchall(z.unknown())

const searchIndexCoreSchema = z.object({
  source: cruiseSourceSchema,
  sourceProvider: z.string().optional().nullable(),
  sourceRef: sourceRefSchema.optional().nullable(),
  localCruiseId: z.string().optional().nullable(),
  slug: slugSchema,
  name: z.string().min(1).max(255),
  cruiseType: cruiseTypeSchema,
  lineName: z.string().min(1).max(255),
  shipName: z.string().min(1).max(255),
  nights: z.number().int().positive(),
  embarkPortName: z.string().optional().nullable(),
  embarkPortCanonicalPlaceId: z.string().optional().nullable(),
  disembarkPortName: z.string().optional().nullable(),
  disembarkPortCanonicalPlaceId: z.string().optional().nullable(),
  regions: z.array(z.string()).default([]),
  themes: z.array(z.string()).default([]),
  earliestDeparture: isoDateSchema.optional().nullable(),
  latestDeparture: isoDateSchema.optional().nullable(),
  lowestPrice: moneyStringSchema.optional().nullable(),
  lowestPriceCurrency: currencyCodeSchema.optional().nullable(),
  salesStatus: z.string().optional().nullable(),
  heroImageUrl: z.string().url().optional().nullable(),
})

export const insertSearchIndexSchema = searchIndexCoreSchema
export const updateSearchIndexSchema = searchIndexCoreSchema.partial()

export const searchIndexQuerySchema = z.object({
  cruiseType: cruiseTypeSchema.optional(),
  region: z.string().optional(),
  theme: z.string().optional(),
  dateFrom: isoDateSchema.optional(),
  dateTo: isoDateSchema.optional(),
  priceMax: z.coerce.number().nonnegative().optional(),
  source: cruiseSourceSchema.optional(),
  embarkPortCanonicalPlaceId: z.string().optional(),
  disembarkPortCanonicalPlaceId: z.string().optional(),
  portCanonicalPlaceId: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

export type InsertSearchIndex = z.infer<typeof insertSearchIndexSchema>
export type UpdateSearchIndex = z.infer<typeof updateSearchIndexSchema>
export type SearchIndexQuery = z.infer<typeof searchIndexQuerySchema>
