import { z } from "zod"

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD")

export const programTypeSchema = z.enum([
  "meeting",
  "incentive",
  "conference",
  "exhibition",
  "other",
])

export const programStatusSchema = z.enum([
  "lead",
  "planning",
  "contracted",
  "operating",
  "completed",
  "cancelled",
])

const programMutationSchema = z.object({
  name: z.string().min(1),
  organizationId: z.string().min(1).optional(),
  primaryContactPersonId: z.string().min(1).optional(),
  accountManagerId: z.string().min(1).optional(),
  code: z.string().optional(),
  type: programTypeSchema,
  status: programStatusSchema,
  destination: z.string().optional(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  estimatedPax: z.number().int().min(0).optional(),
  confirmedPax: z.number().int().min(0).optional(),
  currency: z.string().optional(),
  budgetAmountCents: z.number().int().min(0).optional(),
})

export const createProgramSchema = programMutationSchema.extend({
  type: programTypeSchema.default("conference"),
  status: programStatusSchema.default("lead"),
})

// Update accepts `null` on the optional fields so a PATCH can CLEAR them (the
// columns are nullable and `updateProgram` spreads the body into `.set()`).
// `.partial()` alone only allows omitting a key, which leaves the prior value
// in place — operators could set an optional field but never clear it.
export const updateProgramSchema = programMutationSchema.partial().extend({
  organizationId: z.string().min(1).nullish(),
  primaryContactPersonId: z.string().min(1).nullish(),
  accountManagerId: z.string().min(1).nullish(),
  code: z.string().nullish(),
  destination: z.string().nullish(),
  startDate: isoDate.nullish(),
  endDate: isoDate.nullish(),
  estimatedPax: z.number().int().min(0).nullish(),
  confirmedPax: z.number().int().min(0).nullish(),
  currency: z.string().nullish(),
  budgetAmountCents: z.number().int().min(0).nullish(),
})

export const programListQuerySchema = z.object({
  status: programStatusSchema.optional(),
  type: programTypeSchema.optional(),
  organizationId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export type CreateProgramBody = z.infer<typeof createProgramSchema>
export type UpdateProgramBody = z.infer<typeof updateProgramSchema>
export type ProgramListQuery = z.infer<typeof programListQuerySchema>
