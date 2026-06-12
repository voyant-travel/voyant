import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { z } from "zod"

import {
  updateChannelBookingLinkSchema,
  updateChannelCommissionRuleSchema,
  updateChannelContractSchema,
  updateChannelInventoryAllotmentSchema,
  updateChannelInventoryAllotmentTargetSchema,
  updateChannelInventoryReleaseRuleSchema,
  updateChannelProductMappingSchema,
  updateChannelSchema,
  updateChannelWebhookEventSchema,
} from "../validation.js"

export const batchIdsSchema = z.object({
  ids: z.array(z.string()).min(1).max(200),
})

const createBatchUpdateSchema = <TPatch extends z.ZodTypeAny>(patchSchema: TPatch) =>
  z.object({
    ids: batchIdsSchema.shape.ids,
    patch: patchSchema.refine((value) => Object.keys(value as Record<string, unknown>).length > 0, {
      message: "Patch payload is required",
    }),
  })

export const batchUpdateChannelSchema = createBatchUpdateSchema(updateChannelSchema)
export const batchUpdateChannelContractSchema = createBatchUpdateSchema(updateChannelContractSchema)
export const batchUpdateChannelCommissionRuleSchema = createBatchUpdateSchema(
  updateChannelCommissionRuleSchema,
)
export const batchUpdateChannelProductMappingSchema = createBatchUpdateSchema(
  updateChannelProductMappingSchema,
)
export const batchUpdateChannelBookingLinkSchema = createBatchUpdateSchema(
  updateChannelBookingLinkSchema,
)
export const batchUpdateChannelWebhookEventSchema = createBatchUpdateSchema(
  updateChannelWebhookEventSchema,
)
export const batchUpdateChannelInventoryAllotmentSchema = createBatchUpdateSchema(
  updateChannelInventoryAllotmentSchema,
)
export const batchUpdateChannelInventoryAllotmentTargetSchema = createBatchUpdateSchema(
  updateChannelInventoryAllotmentTargetSchema,
)
export const batchUpdateChannelInventoryReleaseRuleSchema = createBatchUpdateSchema(
  updateChannelInventoryReleaseRuleSchema,
)

export async function handleBatchUpdate<TPatch, TRow>({
  db,
  ids,
  patch,
  update,
}: {
  db: PostgresJsDatabase
  ids: string[]
  patch: TPatch
  update: (db: PostgresJsDatabase, id: string, patch: TPatch) => Promise<TRow | null>
}) {
  const results = await Promise.all(
    ids.map(async (id) => {
      const row = await update(db, id, patch)
      return row ? { id, row } : { id, row: null }
    }),
  )

  const data = results.flatMap((result) => (result.row ? [result.row] : []))
  const failed = results
    .filter((result) => result.row === null)
    .map((result) => ({ id: result.id, error: "Not found" }))

  return {
    data,
    total: ids.length,
    succeeded: data.length,
    failed,
  }
}

export async function handleBatchDelete({
  db,
  ids,
  remove,
}: {
  db: PostgresJsDatabase
  ids: string[]
  remove: (db: PostgresJsDatabase, id: string) => Promise<{ id: string } | null>
}) {
  const results = await Promise.all(
    ids.map(async (id) => {
      const row = await remove(db, id)
      return row ? { id } : { id, error: "Not found" }
    }),
  )

  const deletedIds = results.flatMap((result) => ("error" in result ? [] : [result.id]))
  const failed = results
    .filter((result): result is { id: string; error: string } => "error" in result)
    .map((result) => ({ id: result.id, error: result.error }))

  return {
    deletedIds,
    total: ids.length,
    succeeded: deletedIds.length,
    failed,
  }
}
