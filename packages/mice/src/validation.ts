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

export const createProgramSchema = z.object({
  name: z.string().min(1),
  organizationId: z.string().min(1).optional(),
  primaryContactPersonId: z.string().min(1).optional(),
  accountManagerId: z.string().min(1).optional(),
  code: z.string().optional(),
  type: programTypeSchema.default("conference"),
  status: programStatusSchema.default("lead"),
  destination: z.string().optional(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  estimatedPax: z.number().int().min(0).optional(),
  confirmedPax: z.number().int().min(0).optional(),
  currency: z.string().optional(),
  budgetAmountCents: z.number().int().min(0).optional(),
})

export const updateProgramSchema = createProgramSchema.partial()

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
