import { z } from "zod"

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD")

export const sessionTypeSchema = z.enum([
  "keynote",
  "breakout",
  "meal",
  "networking",
  "gala",
  "excursion",
  "free",
])

export const sessionInclusionKindSchema = z.enum(["fnb", "av", "materials", "signage", "other"])

const sessionMutationSchema = z.object({
  programId: z.string().min(1),
  title: z.string().min(1),
  sessionType: sessionTypeSchema,
  functionSpaceId: z.string().min(1).optional(),
  dayDate: isoDate.optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  track: z.string().optional(),
  capacity: z.number().int().min(0).optional(),
  requiresRegistration: z.boolean().optional(),
  notes: z.string().optional(),
})

export const createSessionSchema = sessionMutationSchema.extend({
  sessionType: sessionTypeSchema.default("breakout"),
})

export const updateSessionSchema = sessionMutationSchema.partial().omit({ programId: true })

export const sessionListQuerySchema = z.object({
  programId: z.string().min(1),
  sessionType: sessionTypeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export const setSessionInclusionsSchema = z.object({
  inclusions: z.array(
    z.object({
      kind: sessionInclusionKindSchema,
      description: z.string().optional(),
      quantity: z.number().int().min(1).default(1),
      costAmountCents: z.number().int().min(0).optional(),
      currency: z.string().optional(),
    }),
  ),
})

export type CreateSessionBody = z.infer<typeof createSessionSchema>
export type UpdateSessionBody = z.infer<typeof updateSessionSchema>
export type SessionListQuery = z.infer<typeof sessionListQuerySchema>
export type SessionInclusionInput = z.infer<typeof setSessionInclusionsSchema>["inclusions"][number]
