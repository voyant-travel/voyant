import { z } from "zod"

export const boardBasisValues = [
  "room_only",
  "bed_breakfast",
  "half_board",
  "full_board",
  "all_inclusive",
] as const

export const boardBasisSchema = z.enum(boardBasisValues)

export type BoardBasis = z.infer<typeof boardBasisSchema>
