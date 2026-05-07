import { and, asc, inArray, ne, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { invoices } from "./schema.js"

type InvoiceStatus = (typeof invoices.$inferSelect)["status"]

const ALL_INVOICE_STATUSES: readonly InvoiceStatus[] = [
  "draft",
  "sent",
  "partially_paid",
  "paid",
  "overdue",
  "void",
]

/** Statuses where balance_due_cents > 0 is meaningful money we're owed. */
const OUTSTANDING_STATUSES: readonly InvoiceStatus[] = ["sent", "partially_paid", "overdue"]

export interface FinanceAggregateOutstandingInvoice {
  id: string
  invoiceNumber: string | null
  bookingId: string | null
  status: InvoiceStatus
  currency: string
  totalCents: number
  balanceDueCents: number
  issueDate: string | null
  dueDate: string | null
}

export interface FinanceAggregates {
  total: number
  countsByStatus: Array<{ status: InvoiceStatus; count: number }>
  /** Issued total (total_cents) grouped by UTC yearMonth + currency. Void excluded. */
  monthlyRevenue: Array<{ yearMonth: string; currency: string; totalCents: number }>
  /** Invoice count per UTC yearMonth, all statuses in range. */
  monthlyInvoiceCounts: Array<{ yearMonth: string; count: number }>
  /**
   * Sum of `balance_due_cents` for invoices still expecting payment — sent /
   * partially_paid / overdue — grouped by currency. Matches the "how much
   * are we owed" dashboard card.
   */
  outstanding: Array<{ currency: string; balanceDueCents: number; count: number }>
  /**
   * Same as outstanding but restricted to invoices whose `due_date` has
   * passed (`due_date < today`). Counts remaining balance, not the original
   * total, so partial payments reduce the number.
   */
  overdue: Array<{ currency: string; balanceDueCents: number; count: number }>
  /**
   * Bounded top-N slice of outstanding invoices ordered by `due_date`
   * (oldest first; nulls last) so the dashboard can render the
   * "needs collection" list without a separate paginated request.
   * Default 5, max 20 — caller bounds via `outstandingTopLimit`.
   */
  outstandingTopN: FinanceAggregateOutstandingInvoice[]
}

export async function getFinanceAggregates(
  db: PostgresJsDatabase,
  options: { from?: string; to?: string; outstandingTopLimit?: number } = {},
): Promise<FinanceAggregates> {
  const outstandingTopLimit = Math.max(0, Math.min(options.outstandingTopLimit ?? 5, 20))
  const fromDate = options.from ? new Date(options.from) : undefined
  const toDate = options.to ? new Date(options.to) : undefined

  const rangeConditions = []
  if (fromDate) rangeConditions.push(sql`${invoices.createdAt} >= ${fromDate}`)
  if (toDate) rangeConditions.push(sql`${invoices.createdAt} < ${toDate}`)
  const rangeWhere = rangeConditions.length ? and(...rangeConditions) : undefined

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(invoices)
    .where(rangeWhere)

  const statusRows = await db
    .select({
      status: invoices.status,
      count: sql<number>`count(*)::int`,
    })
    .from(invoices)
    .where(rangeWhere)
    .groupBy(invoices.status)

  const countsByStatusMap = new Map<InvoiceStatus, number>(
    statusRows.map((row) => [row.status, row.count]),
  )

  const monthlyInvoiceCountsRows = await db
    .select({
      yearMonth: sql<string>`to_char(${invoices.createdAt} at time zone 'UTC', 'YYYY-MM')`,
      count: sql<number>`count(*)::int`,
    })
    .from(invoices)
    .where(rangeWhere)
    .groupBy(sql`to_char(${invoices.createdAt} at time zone 'UTC', 'YYYY-MM')`)
    .orderBy(sql`to_char(${invoices.createdAt} at time zone 'UTC', 'YYYY-MM')`)

  const monthlyRevenueRows = await db
    .select({
      yearMonth: sql<string>`to_char(${invoices.createdAt} at time zone 'UTC', 'YYYY-MM')`,
      currency: invoices.currency,
      totalCents: sql<number>`coalesce(sum(${invoices.totalCents}), 0)::bigint`,
    })
    .from(invoices)
    .where(and(...(rangeConditions.length ? rangeConditions : []), ne(invoices.status, "void")))
    .groupBy(sql`to_char(${invoices.createdAt} at time zone 'UTC', 'YYYY-MM')`, invoices.currency)
    .orderBy(sql`to_char(${invoices.createdAt} at time zone 'UTC', 'YYYY-MM')`, invoices.currency)

  // Outstanding + overdue always look at the whole book (not the date range),
  // since "what are we owed right now" is a point-in-time question — bounding
  // it by `from..to` would hide old unpaid invoices.
  const outstandingRows = await db
    .select({
      currency: invoices.currency,
      balanceDueCents: sql<number>`coalesce(sum(${invoices.balanceDueCents}), 0)::bigint`,
      count: sql<number>`count(*)::int`,
    })
    .from(invoices)
    .where(
      and(
        inArray(invoices.status, [...OUTSTANDING_STATUSES]),
        sql`${invoices.balanceDueCents} > 0`,
      ),
    )
    .groupBy(invoices.currency)
    .orderBy(invoices.currency)

  const todayUtc = new Date()
  todayUtc.setUTCHours(0, 0, 0, 0)
  const todayDateString = todayUtc.toISOString().slice(0, 10)

  const overdueRows = await db
    .select({
      currency: invoices.currency,
      balanceDueCents: sql<number>`coalesce(sum(${invoices.balanceDueCents}), 0)::bigint`,
      count: sql<number>`count(*)::int`,
    })
    .from(invoices)
    .where(
      and(
        inArray(invoices.status, [...OUTSTANDING_STATUSES]),
        sql`${invoices.balanceDueCents} > 0`,
        sql`${invoices.dueDate} < ${todayDateString}`,
      ),
    )
    .groupBy(invoices.currency)
    .orderBy(invoices.currency)

  const outstandingTopRows =
    outstandingTopLimit === 0
      ? []
      : await db
          .select({
            id: invoices.id,
            invoiceNumber: invoices.invoiceNumber,
            bookingId: invoices.bookingId,
            status: invoices.status,
            currency: invoices.currency,
            totalCents: invoices.totalCents,
            balanceDueCents: invoices.balanceDueCents,
            issueDate: invoices.issueDate,
            dueDate: invoices.dueDate,
          })
          .from(invoices)
          .where(
            and(
              inArray(invoices.status, [...OUTSTANDING_STATUSES]),
              sql`${invoices.balanceDueCents} > 0`,
            ),
          )
          // Nulls-last on dueDate so undated invoices don't pretend to be
          // the most overdue. After that, oldest issued first.
          .orderBy(
            sql`${invoices.dueDate} IS NULL`,
            asc(invoices.dueDate),
            asc(invoices.issueDate),
            asc(invoices.id),
          )
          .limit(outstandingTopLimit)

  return {
    total: totalRow?.count ?? 0,
    countsByStatus: ALL_INVOICE_STATUSES.map((status) => ({
      status,
      count: countsByStatusMap.get(status) ?? 0,
    })),
    monthlyRevenue: monthlyRevenueRows.map((row) => ({
      yearMonth: row.yearMonth,
      currency: row.currency,
      totalCents: Number(row.totalCents),
    })),
    monthlyInvoiceCounts: monthlyInvoiceCountsRows.map((row) => ({
      yearMonth: row.yearMonth,
      count: row.count,
    })),
    outstanding: outstandingRows.map((row) => ({
      currency: row.currency,
      balanceDueCents: Number(row.balanceDueCents),
      count: row.count,
    })),
    overdue: overdueRows.map((row) => ({
      currency: row.currency,
      balanceDueCents: Number(row.balanceDueCents),
      count: row.count,
    })),
    outstandingTopN: outstandingTopRows.map((row) => ({
      id: row.id,
      invoiceNumber: row.invoiceNumber ?? null,
      bookingId: row.bookingId ?? null,
      status: row.status,
      currency: row.currency,
      totalCents: Number(row.totalCents),
      balanceDueCents: Number(row.balanceDueCents),
      issueDate: row.issueDate ?? null,
      dueDate: row.dueDate ?? null,
    })),
  }
}
