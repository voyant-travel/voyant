import { z } from "zod"

/**
 * Offset pagination query, matching the framework's admin-route convention
 * (`limit`/`offset`/`sortBy`/`sortDir`). Domain list inputs extend this.
 */
export const pageQuerySchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
  sortBy: z.string().optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
})

export type PageQuery = z.infer<typeof pageQuerySchema>

/**
 * The framework's list response envelope: `{ data, total, limit, offset }`.
 * Build a concrete schema with `paginated(itemSchema)`.
 */
export function paginated<TItem extends z.ZodTypeAny>(item: TItem) {
  return z.object({
    data: z.array(item),
    total: z.number().int().nonnegative(),
    limit: z.number().int().nonnegative(),
    offset: z.number().int().nonnegative(),
  })
}

export interface Paginated<TItem> {
  data: TItem[]
  total: number
  limit: number
  offset: number
}

/**
 * Cursor pagination query, matching the action-ledger-style endpoints that
 * page by opaque cursor (`limit` up to 199).
 */
export const cursorPageQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(199).default(50),
})

export type CursorPageQuery = z.infer<typeof cursorPageQuerySchema>

export interface CursorPage<TItem> {
  data: TItem[]
  pageInfo: { nextCursor: string | null }
}
