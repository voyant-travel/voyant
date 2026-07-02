import { z } from "zod"

export const delegateRoleSchema = z.enum([
  "attendee",
  "speaker",
  "sponsor",
  "vip",
  "staff",
  "exhibitor",
  "organizer",
])

export const delegateStatusSchema = z.enum([
  "invited",
  "registered",
  "confirmed",
  "checked_in",
  "no_show",
  "cancelled",
])

export const enrollmentStatusSchema = z.enum(["registered", "waitlisted", "attended", "cancelled"])

const delegateMutationSchema = z.object({
  programId: z.string().min(1),
  personId: z.string().min(1).optional(),
  bookingId: z.string().min(1).optional(),
  role: delegateRoleSchema,
  status: delegateStatusSchema,
  arrivalAt: z.string().datetime().optional(),
  departureAt: z.string().datetime().optional(),
  notes: z.string().optional(),
})

export const createDelegateSchema = delegateMutationSchema.extend({
  role: delegateRoleSchema.default("attendee"),
  status: delegateStatusSchema.default("invited"),
})

export const updateDelegateSchema = delegateMutationSchema.partial().omit({ programId: true })

export const delegateListQuerySchema = z.object({
  programId: z.string().min(1),
  status: delegateStatusSchema.optional(),
  role: delegateRoleSchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
})

export const enrollDelegateSchema = z.object({
  sessionId: z.string().min(1),
  status: enrollmentStatusSchema.default("registered"),
})

export type CreateDelegateBody = z.infer<typeof createDelegateSchema>
export type UpdateDelegateBody = z.infer<typeof updateDelegateSchema>
export type DelegateListQuery = z.infer<typeof delegateListQuerySchema>
export type EnrollDelegateBody = z.infer<typeof enrollDelegateSchema>
