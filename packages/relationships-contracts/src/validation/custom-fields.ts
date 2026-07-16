import { z } from "zod"

import { customFieldTargetSchema, customFieldTypeSchema, paginationSchema } from "./common.js"

export const customFieldDefinitionCoreSchema = z.object({
  entityType: customFieldTargetSchema,
  key: z.string().min(1),
  label: z.string().min(1),
  fieldType: customFieldTypeSchema,
  isRequired: z.boolean().default(false),
  isSearchable: z.boolean().default(false),
  isExportable: z.boolean().default(true),
  isInvoiceable: z.boolean().default(false),
  options: z
    .array(z.object({ label: z.string(), value: z.string() }))
    .nullable()
    .optional(),
})

export const insertCustomFieldDefinitionSchema = customFieldDefinitionCoreSchema
// `entityType` and `fieldType` are immutable after creation: changing the entity
// type would point the definition at a different physical table (orphaning every
// stored value), and changing the field type would reinterpret already-stored
// JSON values under the wrong type. They are omitted from the update surface
// (renaming `key` is allowed — the service migrates the JSON keys in lockstep).
export const updateCustomFieldDefinitionSchema = customFieldDefinitionCoreSchema
  .omit({ entityType: true, fieldType: true })
  .partial()
export const customFieldDefinitionListQuerySchema = paginationSchema.extend({
  entityType: customFieldTargetSchema.optional(),
})

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
