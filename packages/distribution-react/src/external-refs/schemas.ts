import { insertExternalRefSchema } from "@voyant-travel/distribution/validation"
import { listResponseSchema } from "@voyant-travel/types"
import { z } from "zod"

export const paginatedEnvelope = listResponseSchema

export const singleEnvelope = <T extends z.ZodTypeAny>(item: T) => z.object({ data: item })
export const successEnvelope = z.object({ success: z.boolean() })

export const externalRefRecordSchema = insertExternalRefSchema.extend({
  id: z.string(),
  externalParentId: z.string().nullable(),
  lastSyncedAt: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type ExternalRefRecord = z.infer<typeof externalRefRecordSchema>

export const externalRefListResponse = paginatedEnvelope(externalRefRecordSchema)
export const externalRefSingleResponse = singleEnvelope(externalRefRecordSchema)
