import { z } from "zod"

export const upsertCustomFieldValueSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  textValue: z.string().nullable().optional(),
  numberValue: z.number().finite().nullable().optional(),
  dateValue: z.string().date().nullable().optional(),
  booleanValue: z.boolean().nullable().optional(),
  monetaryValueCents: z.number().int().nullable().optional(),
  currencyCode: z.string().nullable().optional(),
  jsonValue: z.record(z.string(), z.unknown()).or(z.array(z.string())).nullable().optional(),
})

export const customFieldValueListQuerySchema = z.object({
  entityType: z.string().min(1).optional(),
  entityId: z.string().min(1).optional(),
  definitionId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

const jsonRecord = z.record(z.string(), z.unknown())

/** Synthetic representation of an entity-column custom-field value. */
export const customFieldValueSchema = z.object({
  id: z.string(),
  definitionId: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  namespace: z.string(),
  key: z.string(),
  textValue: z.string().nullable(),
  numberValue: z.number().nullable(),
  dateValue: z.string().nullable(),
  booleanValue: z.boolean().nullable(),
  monetaryValueCents: z.number().int().nullable(),
  currencyCode: z.string().nullable(),
  jsonValue: z.union([jsonRecord, z.array(z.string())]).nullable(),
})

export type CustomFieldValueListQuery = z.infer<typeof customFieldValueListQuerySchema>
export type UpsertCustomFieldValueInput = z.infer<typeof upsertCustomFieldValueSchema>
