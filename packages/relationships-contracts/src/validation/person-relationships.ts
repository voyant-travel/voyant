import { z } from "zod"

import { paginationSchema } from "./common.js"

// ---------- person relationships ----------

export const personRelationshipKindSchema = z.enum([
  "spouse",
  "partner",
  "parent",
  "child",
  "sibling",
  "guardian",
  "ward",
  "emergency_contact",
  "friend",
  "travel_companion",
  "other",
])

const personRelationshipCoreSchema = z.object({
  toPersonId: z.string().min(1),
  kind: personRelationshipKindSchema,
  inverseKind: personRelationshipKindSchema.nullable().optional(),
  startDate: z.string().date().nullable().optional(),
  endDate: z.string().date().nullable().optional(),
  isPrimary: z.boolean().default(false),
  notes: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  /**
   * Set to false to skip writing the symmetric edge when
   * `inverseKind` is provided. Defaults to `true` so operator UIs
   * don't have to maintain both sides.
   */
  autoInverse: z.boolean().optional(),
})

function validateDateRange(
  data: { startDate?: string | null; endDate?: string | null },
  ctx: z.RefinementCtx,
) {
  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    ctx.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "endDate must be on or after startDate",
    })
  }
}

export const insertPersonRelationshipSchema =
  personRelationshipCoreSchema.superRefine(validateDateRange)
export const updatePersonRelationshipSchema = personRelationshipCoreSchema
  .partial()
  .omit({ toPersonId: true, autoInverse: true })
  .superRefine(validateDateRange)

export const personRelationshipListQuerySchema = paginationSchema.extend({
  kind: personRelationshipKindSchema.optional(),
  /**
   * `from` returns only outgoing edges, `to` only incoming, `both`
   * (the default) returns the union — the typical UI shape.
   */
  direction: z.enum(["from", "to", "both"]).default("both"),
})

export type PersonRelationshipInput = z.infer<typeof insertPersonRelationshipSchema>
export type PersonRelationshipUpdate = z.infer<typeof updatePersonRelationshipSchema>
export type PersonRelationshipListQueryInput = z.infer<typeof personRelationshipListQuerySchema>
