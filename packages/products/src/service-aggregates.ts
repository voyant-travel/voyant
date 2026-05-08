import { and, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { products } from "./schema-core.js"

type ProductStatus = (typeof products.$inferSelect)["status"]

const ALL_PRODUCT_STATUSES: readonly ProductStatus[] = ["draft", "active", "archived"]

export interface ProductAggregates {
  total: number
  countsByStatus: Array<{ status: ProductStatus; count: number }>
  /** Shorthand for the `active` bucket — dashboard KPI card. */
  active: number
  /**
   * Products publicly listed on the storefront: `status = active` AND
   * `activated = true` AND `visibility = 'public'`. Distinct from `active`,
   * which includes internal-only active products.
   */
  publicActive: number
  /** Product creation count bucketed by UTC yearMonth, oldest first. */
  monthlyCreatedCounts: Array<{ yearMonth: string; count: number }>
}

export async function getProductAggregates(
  db: PostgresJsDatabase,
  options: { from?: string; to?: string } = {},
): Promise<ProductAggregates> {
  const fromDate = options.from ? new Date(options.from) : undefined
  const toDate = options.to ? new Date(options.to) : undefined

  const rangeConditions = []
  if (fromDate) rangeConditions.push(sql`${products.createdAt} >= ${fromDate.toISOString()}`)
  if (toDate) rangeConditions.push(sql`${products.createdAt} < ${toDate.toISOString()}`)
  const rangeWhere = rangeConditions.length ? and(...rangeConditions) : undefined

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(rangeWhere)

  const statusRows = await db
    .select({ status: products.status, count: sql<number>`count(*)::int` })
    .from(products)
    .where(rangeWhere)
    .groupBy(products.status)

  const statusMap = new Map<ProductStatus, number>(statusRows.map((r) => [r.status, r.count]))

  // Publicly-listed count ignores the date range — it's a point-in-time KPI
  // ("what's live on the storefront right now"). The range-bound `active`
  // bucket serves the "how many active products did we create this quarter"
  // question instead.
  const [publicActiveRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(
      and(
        eq(products.status, "active"),
        eq(products.activated, true),
        eq(products.visibility, "public"),
      ),
    )

  const monthlyCreatedCountsRows = await db
    .select({
      yearMonth: sql<string>`to_char(${products.createdAt} at time zone 'UTC', 'YYYY-MM')`,
      count: sql<number>`count(*)::int`,
    })
    .from(products)
    .where(rangeWhere)
    .groupBy(sql`to_char(${products.createdAt} at time zone 'UTC', 'YYYY-MM')`)
    .orderBy(sql`to_char(${products.createdAt} at time zone 'UTC', 'YYYY-MM')`)

  return {
    total: totalRow?.count ?? 0,
    countsByStatus: ALL_PRODUCT_STATUSES.map((status) => ({
      status,
      count: statusMap.get(status) ?? 0,
    })),
    active: statusMap.get("active") ?? 0,
    publicActive: publicActiveRow?.count ?? 0,
    monthlyCreatedCounts: monthlyCreatedCountsRows.map((row) => ({
      yearMonth: row.yearMonth,
      count: row.count,
    })),
  }
}
