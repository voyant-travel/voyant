import { z } from "zod"

// ---------- segments ----------

export const insertSegmentSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  conditions: z.record(z.string(), z.unknown()).nullable().optional(),
})
