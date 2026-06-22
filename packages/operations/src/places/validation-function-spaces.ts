import { z } from "zod"

export const functionSpaceLayoutSchema = z.enum([
  "theater",
  "classroom",
  "banquet",
  "cabaret",
  "boardroom",
  "u_shape",
  "reception",
  "hollow_square",
])

export const createFunctionSpaceSchema = z.object({
  facilityId: z.string().min(1),
  name: z.string().min(1),
  parentSpaceId: z.string().min(1).optional(),
  code: z.string().optional(),
  description: z.string().optional(),
  areaSqm: z.number().positive().optional(),
  divisible: z.boolean().optional(),
  defaultLayout: functionSpaceLayoutSchema.optional(),
  sortOrder: z.number().int().min(0).optional(),
})

export const updateFunctionSpaceSchema = createFunctionSpaceSchema
  .partial()
  .extend({ active: z.boolean().optional() })

export const functionSpaceListQuerySchema = z.object({
  facilityId: z.string().min(1).optional(),
  parentSpaceId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export const setFunctionSpaceCapacitiesSchema = z.object({
  capacities: z
    .array(
      z.object({
        layout: functionSpaceLayoutSchema,
        capacity: z.number().int().min(0),
      }),
    )
    .min(1),
})

export type CreateFunctionSpaceBody = z.infer<typeof createFunctionSpaceSchema>
export type UpdateFunctionSpaceBody = z.infer<typeof updateFunctionSpaceSchema>
export type FunctionSpaceListQuery = z.infer<typeof functionSpaceListQuerySchema>
export type SetFunctionSpaceCapacitiesBody = z.infer<typeof setFunctionSpaceCapacitiesSchema>
