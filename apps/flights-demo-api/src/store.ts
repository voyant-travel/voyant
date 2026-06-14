/**
 * Persistence layer for the demo flight service. Wraps `demo_flight_orders`
 * with the operations the routes need: insert on book, lookup by id, list
 * with filters/pagination, status update on cancel.
 */

import type {
  FlightBookRequest,
  FlightOrder,
  FlightOrderStatus,
} from "@voyant-travel/flights/contract/types"
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm"

import type { DemoFlightsDb } from "./db.js"
import { demoFlightOrders, type NewDemoFlightOrderRow } from "./schema.js"

export async function insertOrder(
  db: DemoFlightsDb,
  order: FlightOrder,
  request: FlightBookRequest,
): Promise<void> {
  const firstPax = order.passengers[0] ?? request.passengers[0]
  const payerName = firstPax ? `${firstPax.firstName} ${firstPax.lastName}`.trim() : null
  const row: NewDemoFlightOrderRow = {
    orderId: order.orderId,
    pnr: order.pnr ?? null,
    status: order.status,
    payerName,
    payerEmail: order.contact?.email ?? request.contact?.email ?? firstPax?.email ?? null,
    totalAmount: order.totalPrice.amount,
    totalCurrency: order.totalPrice.currency,
    payload: order,
  }
  await db.insert(demoFlightOrders).values(row)
}

export async function getOrder(db: DemoFlightsDb, orderId: string): Promise<FlightOrder | null> {
  const [row] = await db
    .select({ payload: demoFlightOrders.payload })
    .from(demoFlightOrders)
    .where(eq(demoFlightOrders.orderId, orderId))
    .limit(1)
  return row?.payload ?? null
}

export async function updateOrder(
  db: DemoFlightsDb,
  orderId: string,
  payload: FlightOrder,
): Promise<void> {
  await db
    .update(demoFlightOrders)
    .set({
      status: payload.status,
      payload,
      updatedAt: new Date(),
    })
    .where(eq(demoFlightOrders.orderId, orderId))
}

export interface ListOrdersFilters {
  cursor?: string
  limit?: number
  search?: string
  status?: FlightOrderStatus[]
}

export interface ListOrdersResult {
  orders: FlightOrder[]
  total: number
  hasMore: boolean
  nextCursor?: string
}

const DEFAULT_PAGE_SIZE = 20

export async function listOrders(
  db: DemoFlightsDb,
  filters: ListOrdersFilters,
): Promise<ListOrdersResult> {
  const limit = Math.min(Math.max(filters.limit ?? DEFAULT_PAGE_SIZE, 1), 100)
  const page = parseCursor(filters.cursor)
  const offset = (page - 1) * limit

  const where = []
  if (filters.status?.length) where.push(inArray(demoFlightOrders.status, filters.status))
  if (filters.search) {
    const needle = `%${filters.search.trim()}%`
    where.push(
      or(
        ilike(demoFlightOrders.payerName, needle),
        ilike(demoFlightOrders.payerEmail, needle),
        ilike(demoFlightOrders.pnr, needle),
        ilike(demoFlightOrders.orderId, needle),
      ),
    )
  }
  const whereClause = where.length > 0 ? and(...where) : sql`true`

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(demoFlightOrders)
    .where(whereClause)
  const total = Number(countRows[0]?.count ?? 0)

  const rows = await db
    .select({ payload: demoFlightOrders.payload })
    .from(demoFlightOrders)
    .where(whereClause)
    .orderBy(desc(demoFlightOrders.createdAt))
    .limit(limit)
    .offset(offset)

  const hasMore = offset + rows.length < total
  return {
    orders: rows.map((r) => r.payload),
    total,
    hasMore,
    ...(hasMore ? { nextCursor: String(page + 1) } : {}),
  }
}

function parseCursor(cursor?: string): number {
  if (!cursor) return 1
  const parsed = Number.parseInt(cursor, 10)
  if (!Number.isFinite(parsed) || parsed < 1) return 1
  return parsed
}
