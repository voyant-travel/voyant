import { z } from "zod"

export const rfpStatusSchema = z.enum(["draft", "issued", "closed", "awarded", "cancelled"])
export const bidStatusSchema = z.enum([
  "draft",
  "submitted",
  "under_review",
  "accepted",
  "rejected",
])

// `awarded` (RFP) and `accepted`/`rejected` (bid) are award-controlled — they may
// only be reached through the atomic `awardRfp` flow, never generic create/update.
const rfpEditableStatusSchema = z.enum(["draft", "issued", "closed", "cancelled"])
const bidEditableStatusSchema = z.enum(["draft", "submitted", "under_review"])

const rfpMutationSchema = z.object({
  programId: z.string().min(1),
  title: z.string().min(1),
  requirements: z.record(z.string(), z.unknown()).optional(),
  status: rfpEditableStatusSchema,
  issuedAt: z.string().datetime().optional(),
  dueAt: z.string().datetime().optional(),
  notes: z.string().optional(),
})

export const createRfpSchema = rfpMutationSchema.extend({
  status: rfpEditableStatusSchema.default("draft"),
})

export const updateRfpSchema = rfpMutationSchema.partial().omit({ programId: true })

export const rfpListQuerySchema = z.object({
  programId: z.string().min(1),
  status: rfpStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export const inviteSupplierSchema = z.object({
  supplierId: z.string().min(1),
})

const bidMutationSchema = z.object({
  supplierId: z.string().min(1),
  status: bidEditableStatusSchema,
  totalCents: z.number().int().min(0).optional(),
  currency: z.string().optional(),
  proposalDoc: z.string().optional(),
  validUntil: z.string().datetime().optional(),
  notes: z.string().optional(),
})

export const createBidSchema = bidMutationSchema.extend({
  status: bidEditableStatusSchema.default("draft"),
})

export const updateBidSchema = bidMutationSchema.partial().omit({ supplierId: true })

export const setBidLinesSchema = z.object({
  lines: z.array(
    z.object({
      requirementRef: z.string().optional(),
      description: z.string().optional(),
      quantity: z.number().int().min(1).default(1),
      unitCents: z.number().int().min(0).optional(),
      totalCents: z.number().int().min(0).optional(),
    }),
  ),
})

export const addBidEvaluationSchema = z.object({
  criterion: z.string().min(1),
  weight: z.number().int().min(0).optional(),
  score: z.number().int().min(0).optional(),
  notes: z.string().optional(),
  evaluatedBy: z.string().optional(),
})

export const awardRfpSchema = z.object({
  bidId: z.string().min(1),
})

export type CreateRfpBody = z.infer<typeof createRfpSchema>
export type UpdateRfpBody = z.infer<typeof updateRfpSchema>
export type RfpListQuery = z.infer<typeof rfpListQuerySchema>
export type InviteSupplierBody = z.infer<typeof inviteSupplierSchema>
export type CreateBidBody = z.infer<typeof createBidSchema>
export type UpdateBidBody = z.infer<typeof updateBidSchema>
export type SetBidLinesBody = z.infer<typeof setBidLinesSchema>
export type AddBidEvaluationBody = z.infer<typeof addBidEvaluationSchema>
