import { z } from "zod"

// ---------- notes ----------

export const insertPersonNoteSchema = z.object({
  content: z.string().min(1).max(10000),
})

export const updatePersonNoteSchema = z.object({
  content: z.string().min(1).max(10000),
})

export const insertOrganizationNoteSchema = z.object({
  content: z.string().min(1).max(10000),
})
