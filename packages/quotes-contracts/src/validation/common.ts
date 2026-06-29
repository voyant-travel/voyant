import { z } from "zod"

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export const entityTypeSchema = z.enum(["organization", "person", "quote", "activity"])

export const quoteStatusSchema = z.enum(["open", "won", "lost", "archived"])
export const quoteVersionStatusSchema = z.enum([
  "draft",
  "sent",
  "accepted",
  "declined",
  "superseded",
  "expired",
])
export const participantRoleSchema = z.enum([
  "traveler",
  "booker",
  "decision_maker",
  "finance",
  "other",
])
