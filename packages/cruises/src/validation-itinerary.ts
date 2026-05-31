import { z } from "./validation-shared.js"

const mealsSchema = z.object({
  breakfast: z.boolean().optional(),
  lunch: z.boolean().optional(),
  dinner: z.boolean().optional(),
})

const cruiseDayCoreSchema = z.object({
  cruiseId: z.string(),
  dayNumber: z.number().int().min(1).max(365),
  title: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  portFacilityId: z.string().optional().nullable(),
  portCanonicalPlaceId: z.string().optional().nullable(),
  arrivalTime: z.string().optional().nullable(),
  departureTime: z.string().optional().nullable(),
  isOvernight: z.boolean().default(false),
  isSeaDay: z.boolean().default(false),
  isExpeditionLanding: z.boolean().default(false),
  meals: mealsSchema.default({}),
})

export const insertCruiseDaySchema = cruiseDayCoreSchema
export const updateCruiseDaySchema = cruiseDayCoreSchema.partial()
export const replaceCruiseDaysSchema = z.object({
  cruiseId: z.string(),
  days: z.array(cruiseDayCoreSchema.omit({ cruiseId: true })),
})

export type InsertCruiseDay = z.infer<typeof insertCruiseDaySchema>
export type UpdateCruiseDay = z.infer<typeof updateCruiseDaySchema>
export type ReplaceCruiseDays = z.infer<typeof replaceCruiseDaysSchema>

const sailingDayOverrideCoreSchema = z.object({
  sailingId: z.string(),
  dayNumber: z.number().int().min(1).max(365),
  title: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  portFacilityId: z.string().optional().nullable(),
  portCanonicalPlaceId: z.string().optional().nullable(),
  arrivalTime: z.string().optional().nullable(),
  departureTime: z.string().optional().nullable(),
  isOvernight: z.boolean().optional().nullable(),
  isSeaDay: z.boolean().optional().nullable(),
  isExpeditionLanding: z.boolean().optional().nullable(),
  isSkipped: z.boolean().default(false),
  meals: mealsSchema.optional().nullable(),
})

export const insertSailingDaySchema = sailingDayOverrideCoreSchema
export const updateSailingDaySchema = sailingDayOverrideCoreSchema.partial()
export const replaceSailingDaysSchema = z.object({
  sailingId: z.string(),
  days: z.array(sailingDayOverrideCoreSchema.omit({ sailingId: true })),
})

export type InsertSailingDay = z.infer<typeof insertSailingDaySchema>
export type UpdateSailingDay = z.infer<typeof updateSailingDaySchema>
export type ReplaceSailingDays = z.infer<typeof replaceSailingDaysSchema>
