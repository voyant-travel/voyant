import { z } from "zod"

import { customFieldTargetSchema, paginationSchema } from "./common.js"

export const upsertCustomFieldValueSchema = z.object({
  entityType: customFieldTargetSchema,
  entityId: z.string(),
  textValue: z.string().nullable().optional(),
  numberValue: z.number().int().nullable().optional(),
  dateValue: z.string().date().nullable().optional(),
  booleanValue: z.boolean().nullable().optional(),
  monetaryValueCents: z.number().int().nullable().optional(),
  currencyCode: z.string().nullable().optional(),
  jsonValue: z.record(z.string(), z.unknown()).or(z.array(z.string())).nullable().optional(),
})

export const customFieldValueListQuerySchema = paginationSchema.extend({
  entityType: customFieldTargetSchema.optional(),
  entityId: z.string().optional(),
  definitionId: z.string().optional(),
})
