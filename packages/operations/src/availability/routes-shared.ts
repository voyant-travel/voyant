import type { EventBus } from "@voyantjs/core"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"
import { z } from "zod"

export type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
    eventBus?: EventBus
  }
}

export const batchIdsSchema = z.object({
  ids: z.array(z.string()).min(1).max(200),
})

export const createBatchUpdateSchema = <TPatch extends z.ZodTypeAny>(patchSchema: TPatch) =>
  z.object({
    ids: batchIdsSchema.shape.ids,
    patch: patchSchema.refine((value) => Object.keys(value as Record<string, unknown>).length > 0, {
      message: "Patch payload is required",
    }),
  })

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

export function notFound(c: Context<Env>, message: string) {
  return c.json({ error: message }, 404)
}
