/**
 * Persistence operations for the demo service. Keeps SQL out of the
 * route handlers so the routes file stays focused on shape mapping.
 */

import { newId } from "@voyant-travel/db/lib/typeid"
import { and, asc, eq, gt, inArray, sql } from "drizzle-orm"

import type { CatalogDemoDb } from "./db.js"
import {
  type CatalogDemoInventoryRow,
  type CatalogDemoOrderRow,
  catalogDemoInventory,
  catalogDemoOrders,
} from "./schema.js"

export interface ListInventoryQuery {
  entityModules?: string[]
  /** Cursor is the row count to skip — opaque from the caller's view. */
  cursor?: string
  limit?: number
}

export interface ListInventoryResult {
  rows: CatalogDemoInventoryRow[]
  hasMore: boolean
  nextCursor?: string
}

const DEFAULT_PAGE_SIZE = 50

export async function listInventory(
  db: CatalogDemoDb,
  query: ListInventoryQuery,
): Promise<ListInventoryResult> {
  const limit = Math.min(Math.max(query.limit ?? DEFAULT_PAGE_SIZE, 1), 200)
  const offset = parseOffset(query.cursor)
  const filters = []
  if (query.entityModules?.length) {
    filters.push(inArray(catalogDemoInventory.entityModule, query.entityModules))
  }
  const where = filters.length > 0 ? and(...filters) : sql`true`

  const rows = (await db
    .select()
    .from(catalogDemoInventory)
    .where(where)
    .orderBy(asc(catalogDemoInventory.createdAt))
    .limit(limit + 1)
    .offset(offset)) as CatalogDemoInventoryRow[]

  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows
  return {
    rows: page,
    hasMore,
    ...(hasMore ? { nextCursor: String(offset + limit) } : {}),
  }
}

export async function getInventoryByIds(
  db: CatalogDemoDb,
  ids: string[],
): Promise<Map<string, CatalogDemoInventoryRow>> {
  if (ids.length === 0) return new Map()
  const rows = (await db
    .select()
    .from(catalogDemoInventory)
    .where(inArray(catalogDemoInventory.id, ids))) as CatalogDemoInventoryRow[]
  const out = new Map<string, CatalogDemoInventoryRow>()
  for (const row of rows) out.set(row.id, row)
  return out
}

export interface CreateOrderInput {
  entityId: string
  entityModule: string
  status: "held" | "confirmed"
  pricedCents: number
  currency: string
  inventoryId: string
  party: Record<string, unknown> | null
  paymentIntent: Record<string, unknown> | null
  parameters: Record<string, unknown> | null
}

export async function createOrder(
  db: CatalogDemoDb,
  input: CreateOrderInput,
): Promise<CatalogDemoOrderRow> {
  const id = newId("catalog_demo_orders")
  const inserted = (await db
    .insert(catalogDemoOrders)
    .values({
      id,
      inventoryId: input.inventoryId,
      entityId: input.entityId,
      entityModule: input.entityModule,
      status: input.status,
      pricedCents: input.pricedCents,
      currency: input.currency,
      party: input.party,
      paymentIntent: input.paymentIntent,
      parameters: input.parameters,
    })
    .returning()) as CatalogDemoOrderRow[]
  if (!inserted[0]) {
    throw new Error("createOrder: insert returned no rows")
  }
  return inserted[0]
}

export async function decrementAvailability(db: CatalogDemoDb, inventoryId: string): Promise<void> {
  await db
    .update(catalogDemoInventory)
    .set({
      // agent-quality: raw-sql reviewed -- owner: catalog-demo-api; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
      available: sql`${catalogDemoInventory.available} - 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(catalogDemoInventory.id, inventoryId), gt(catalogDemoInventory.available, 0)))
}

export async function incrementAvailability(db: CatalogDemoDb, inventoryId: string): Promise<void> {
  await db
    .update(catalogDemoInventory)
    .set({
      // agent-quality: raw-sql reviewed -- owner: catalog-demo-api; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
      available: sql`${catalogDemoInventory.available} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(catalogDemoInventory.id, inventoryId))
}

export async function adjustDepartureRemaining(
  db: CatalogDemoDb,
  inventoryId: string,
  departureId: string,
  delta: number,
): Promise<void> {
  if (!Number.isFinite(delta) || delta === 0) return

  const rows = (await db
    .select({ metadata: catalogDemoInventory.metadata })
    .from(catalogDemoInventory)
    .where(eq(catalogDemoInventory.id, inventoryId))
    .limit(1)) as Array<{ metadata: Record<string, unknown> | null }>
  const metadata = rows[0]?.metadata
  const departures = metadata?.departures
  if (!Array.isArray(departures)) return

  let changed = false
  const nextDepartures = departures.map((departure) => {
    if (
      !departure ||
      typeof departure !== "object" ||
      (departure as Record<string, unknown>).id !== departureId
    ) {
      return departure
    }

    const row = departure as Record<string, unknown>
    const capacity = typeof row.capacity === "number" ? row.capacity : null
    const current =
      typeof row.remaining === "number" ? row.remaining : capacity != null ? capacity : null
    if (current == null) return departure

    const nextRemaining =
      capacity == null
        ? Math.max(0, current + delta)
        : Math.max(0, Math.min(capacity, current + delta))
    if (nextRemaining === current) return departure
    changed = true
    return { ...row, remaining: nextRemaining }
  })

  if (!changed) return
  await db
    .update(catalogDemoInventory)
    .set({
      metadata: { ...metadata, departures: nextDepartures },
      updatedAt: new Date(),
    })
    .where(eq(catalogDemoInventory.id, inventoryId))
}

export async function getOrder(db: CatalogDemoDb, id: string): Promise<CatalogDemoOrderRow | null> {
  const rows = (await db
    .select()
    .from(catalogDemoOrders)
    .where(eq(catalogDemoOrders.id, id))
    .limit(1)) as CatalogDemoOrderRow[]
  return rows[0] ?? null
}

export async function markOrderCancelled(
  db: CatalogDemoDb,
  id: string,
  reason: string | null,
): Promise<CatalogDemoOrderRow | null> {
  const updated = (await db
    .update(catalogDemoOrders)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      cancelledReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(catalogDemoOrders.id, id))
    .returning()) as CatalogDemoOrderRow[]
  return updated[0] ?? null
}

function parseOffset(cursor?: string): number {
  if (!cursor) return 0
  const parsed = Number.parseInt(cursor, 10)
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return parsed
}
