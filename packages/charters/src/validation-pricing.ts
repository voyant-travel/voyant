import {
  externalRefsSchema,
  pricesByCurrencySchema,
  suiteAvailabilitySchema,
  suiteCategorySchema,
  z,
} from "./validation-shared.js"

const suiteCoreSchema = z.object({
  voyageId: z.string(),
  suiteCode: z.string().min(1).max(100),
  suiteName: z.string().min(1).max(255),
  suiteCategory: suiteCategorySchema.optional().nullable(),
  description: z.string().optional().nullable(),
  squareFeet: z.string().optional().nullable(),
  images: z.array(z.string()).default([]),
  floorplanImages: z.array(z.string()).default([]),
  maxGuests: z.number().int().min(1).max(20).optional().nullable(),

  /** Per-currency suite price map. Adding a new currency is data-only. */
  pricesByCurrency: pricesByCurrencySchema.default({}),
  /** Optional per-currency port fee map, separate from suite price. */
  portFeesByCurrency: pricesByCurrencySchema.default({}),

  availability: suiteAvailabilitySchema.default("available"),
  unitsAvailable: z.number().int().nonnegative().optional().nullable(),
  appointmentOnly: z.boolean().default(false),
  notes: z.string().optional().nullable(),

  extra: z.record(z.string(), z.unknown()).default({}),
  externalRefs: externalRefsSchema,
})

export const insertSuiteSchema = suiteCoreSchema
export const updateSuiteSchema = suiteCoreSchema.partial()

export const replaceVoyageSuitesSchema = z.object({
  voyageId: z.string(),
  suites: z.array(suiteCoreSchema.omit({ voyageId: true })),
})

export type InsertSuite = z.infer<typeof insertSuiteSchema>
export type UpdateSuite = z.infer<typeof updateSuiteSchema>
export type ReplaceVoyageSuites = z.infer<typeof replaceVoyageSuitesSchema>
