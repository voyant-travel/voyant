import { typeIdSchema } from "@voyantjs/db/lib/typeid"
import { z } from "zod"

export const externalRefStatusSchema = z.enum(["active", "inactive", "archived"])

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

const externalRefCoreSchema = z.object({
  entityType: z.string().min(1).max(100),
  entityId: z.string().min(1).max(100),
  sourceSystem: z.string().min(1).max(100),
  objectType: z.string().min(1).max(100),
  namespace: z.string().min(1).max(100).default("default"),
  externalId: z.string().min(1).max(255),
  externalParentId: z.string().max(255).nullable().optional(),
  isPrimary: z.boolean().default(false),
  status: externalRefStatusSchema.default("active"),
  lastSyncedAt: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

export const insertExternalRefSchema = externalRefCoreSchema
export const updateExternalRefSchema = externalRefCoreSchema.partial()
export const insertExternalRefForEntitySchema = externalRefCoreSchema.omit({
  entityType: true,
  entityId: true,
})

export const externalRefListQuerySchema = paginationSchema.extend({
  entityType: z.string().max(100).optional(),
  entityId: z.string().max(100).optional(),
  sourceSystem: z.string().max(100).optional(),
  objectType: z.string().max(100).optional(),
  namespace: z.string().max(100).optional(),
  status: externalRefStatusSchema.optional(),
  search: z.string().optional(),
})

export const selectExternalRefSchema = externalRefCoreSchema.extend({
  id: typeIdSchema("external_refs"),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})
