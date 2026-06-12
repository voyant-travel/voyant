import { and, asc, inArray, ne, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { invoices, paymentSessions, payments } from "./schema.js"

type InvoiceStatus = (typeof invoices.$inferSelect)["status"]
type InvoiceType = Extract<(typeof invoices.$inferSelect)["invoiceType"], "invoice" | "proforma">
type PaymentSessionStatus = (typeof paymentSessions.$inferSelect)["status"]

const ALL_INVOICE_STATUSES: readonly InvoiceStatus[] = [
  "draft",
  "pending_external_allocation",
  "issued",
  "partially_paid",
  "paid",
  "overdue",
  "void",
]

/** Statuses where balance_due_cents > 0 is meaningful money we're owed. */
const OUTSTANDING_STATUSES: readonly InvoiceStatus[] = ["issued", "partially_paid", "overdue"]

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
  counts: {
    invoices: { issued: number; paid: number; void: number; overdue: number }
    proformas: { issued: number; converted: number; void: number }
    paymentSessions: { pending: number; paid: number; failed: number }
  }
  totals: Array<{
    currency: string
    invoiced: number
    collected: number
    outstanding: number
    refunded: number
  }>
  /** Issued total (total_cents) grouped by UTC yearMonth + currency. Void excluded. */
  monthlyRevenue: Array<{ yearMonth: string; currency: string; totalCents: number }>
  /** Invoice count per UTC yearMonth, all statuses in range. */
  monthlyInvoiceCounts: Array<{ yearMonth: string; count: number }>
  /**
   * Sum of `balance_due_cents` for invoices still expecting payment — issued /
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
  options: {
    range?: "this_month" | "last_month" | "year_to_date" | "all_time" | "custom"
    from?: string
    to?: string
    currency?: string[]
    invoiceType?: InvoiceType[]
    status?: InvoiceStatus[]
    outstandingTopLimit?: number
  } = {},
): Promise<FinanceAggregates> {
  const outstandingTopLimit = Math.max(0, Math.min(options.outstandingTopLimit ?? 5, 20))
  const { fromDate, toDate } = resolveAggregateRange(options)

  const rangeConditions = []
  // agent-quality: raw-sql reviewed -- owner: finance; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
  if (fromDate) rangeConditions.push(sql`${invoices.createdAt} >= ${fromDate.toISOString()}`)
  // agent-quality: raw-sql reviewed -- owner: finance; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
  if (toDate) rangeConditions.push(sql`${invoices.createdAt} < ${toDate.toISOString()}`)
  const invoiceConditions = [...rangeConditions]
  if (options.currency?.length) invoiceConditions.push(inArray(invoices.currency, options.currency))
  if (options.invoiceType?.length) {
    invoiceConditions.push(inArray(invoices.invoiceType, options.invoiceType))
  }
  if (options.status?.length) invoiceConditions.push(inArray(invoices.status, options.status))
  const rangeWhere = invoiceConditions.length ? and(...invoiceConditions) : undefined

  const paymentConditions = []
  // agent-quality: raw-sql reviewed -- owner: finance; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
  if (fromDate) paymentConditions.push(sql`${payments.paymentDate} >= ${dateOnly(fromDate)}`)
  // agent-quality: raw-sql reviewed -- owner: finance; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
  if (toDate) paymentConditions.push(sql`${payments.paymentDate} < ${dateOnly(toDate)}`)
  if (options.currency?.length) paymentConditions.push(inArray(payments.currency, options.currency))
  const paymentWhere = paymentConditions.length ? and(...paymentConditions) : undefined

  const sessionConditions = []
  if (fromDate)
    // agent-quality: raw-sql reviewed -- owner: finance; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
    sessionConditions.push(sql`${paymentSessions.createdAt} >= ${fromDate.toISOString()}`)
  // agent-quality: raw-sql reviewed -- owner: finance; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
  if (toDate) sessionConditions.push(sql`${paymentSessions.createdAt} < ${toDate.toISOString()}`)
  if (options.currency?.length) {
    sessionConditions.push(inArray(paymentSessions.currency, options.currency))
  }
  const sessionWhere = sessionConditions.length ? and(...sessionConditions) : undefined

  // Outstanding + overdue always look at the whole book (not the date range),
  // since "what are we owed right now" is a point-in-time question — bounding
  // it by `from..to` would hide old unpaid invoices.
  const todayUtc = new Date()
  todayUtc.setUTCHours(0, 0, 0, 0)
  const todayDateString = todayUtc.toISOString().slice(0, 10)
  const outstandingWhere = and(
    inArray(invoices.status, [...OUTSTANDING_STATUSES]),
    // agent-quality: raw-sql reviewed -- owner: finance; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
    sql`${invoices.balanceDueCents} > 0`,
  )

  const [
    [totalRow],
    statusRows,
    monthlyInvoiceCountsRows,
    monthlyRevenueRows,
    invoiceSummaryRows,
    invoiceTotalsRows,
    paymentTotalsRows,
    paymentSessionRows,
    outstandingRows,
    overdueRows,
    outstandingTopRows,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(invoices).where(rangeWhere),
    db
      .select({
        status: invoices.status,
        count: sql<number>`count(*)::int`,
      })
      .from(invoices)
      .where(rangeWhere)
      .groupBy(invoices.status),
    db
      .select({
        yearMonth: sql<string>`to_char(${invoices.createdAt} at time zone 'UTC', 'YYYY-MM')`,
        count: sql<number>`count(*)::int`,
      })
      .from(invoices)
      .where(rangeWhere)
      // agent-quality: raw-sql reviewed -- owner: finance; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
      .groupBy(sql`to_char(${invoices.createdAt} at time zone 'UTC', 'YYYY-MM')`)
      // agent-quality: raw-sql reviewed -- owner: finance; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
      .orderBy(sql`to_char(${invoices.createdAt} at time zone 'UTC', 'YYYY-MM')`),
    db
      .select({
        yearMonth: sql<string>`to_char(${invoices.createdAt} at time zone 'UTC', 'YYYY-MM')`,
        currency: invoices.currency,
        totalCents: sql<number>`coalesce(sum(${invoices.totalCents}), 0)::bigint`,
      })
      .from(invoices)
      .where(and(...invoiceConditions, ne(invoices.status, "void")))
      // agent-quality: raw-sql reviewed -- owner: finance; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
      .groupBy(sql`to_char(${invoices.createdAt} at time zone 'UTC', 'YYYY-MM')`, invoices.currency)
      .orderBy(
        // agent-quality: raw-sql reviewed -- owner: finance; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
        sql`to_char(${invoices.createdAt} at time zone 'UTC', 'YYYY-MM')`,
        invoices.currency,
      ),
    db
      .select({
        invoiceType: invoices.invoiceType,
        status: invoices.status,
        count: sql<number>`count(*)::int`,
      })
      .from(invoices)
      .where(rangeWhere)
      .groupBy(invoices.invoiceType, invoices.status),
    db
      .select({
        currency: invoices.currency,
        invoiced: sql<number>`coalesce(sum(case when ${invoices.status} != 'void' then ${invoices.totalCents} else 0 end), 0)::bigint`,
        outstanding: sql<number>`coalesce(sum(case when ${invoices.status} not in ('paid', 'void') then ${invoices.balanceDueCents} else 0 end), 0)::bigint`,
      })
      .from(invoices)
      .where(rangeWhere)
      .groupBy(invoices.currency)
      .orderBy(invoices.currency),
    db
      .select({
        currency: payments.currency,
        collected: sql<number>`coalesce(sum(case when ${payments.status} = 'completed' then ${payments.amountCents} else 0 end), 0)::bigint`,
        refunded: sql<number>`coalesce(sum(case when ${payments.status} = 'refunded' then ${payments.amountCents} else 0 end), 0)::bigint`,
      })
      .from(payments)
      .where(paymentWhere)
      .groupBy(payments.currency)
      .orderBy(payments.currency),
    db
      .select({
        status: paymentSessions.status,
        count: sql<number>`count(*)::int`,
      })
      .from(paymentSessions)
      .where(sessionWhere)
      .groupBy(paymentSessions.status),
    db
      .select({
        currency: invoices.currency,
        balanceDueCents: sql<number>`coalesce(sum(${invoices.balanceDueCents}), 0)::bigint`,
        count: sql<number>`count(*)::int`,
      })
      .from(invoices)
      .where(outstandingWhere)
      .groupBy(invoices.currency)
      .orderBy(invoices.currency),
    db
      .select({
        currency: invoices.currency,
        balanceDueCents: sql<number>`coalesce(sum(${invoices.balanceDueCents}), 0)::bigint`,
        count: sql<number>`count(*)::int`,
      })
      .from(invoices)
      // agent-quality: raw-sql reviewed -- owner: finance; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
      .where(and(outstandingWhere, sql`${invoices.dueDate} < ${todayDateString}`))
      .groupBy(invoices.currency)
      .orderBy(invoices.currency),
    outstandingTopLimit === 0
      ? Promise.resolve([] as FinanceAggregateOutstandingInvoice[])
      : db
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
          .where(outstandingWhere)
          // Nulls-last on dueDate so undated invoices don't pretend to be
          // the most overdue. After that, oldest issued first.
          .orderBy(
            // agent-quality: raw-sql reviewed -- owner: finance; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
            sql`${invoices.dueDate} IS NULL`,
            asc(invoices.dueDate),
            asc(invoices.issueDate),
            asc(invoices.id),
          )
          .limit(outstandingTopLimit),
  ])

  const countsByStatusMap = new Map<InvoiceStatus, number>(
    statusRows.map((row) => [row.status, row.count]),
  )

  return {
    total: totalRow?.count ?? 0,
    countsByStatus: ALL_INVOICE_STATUSES.map((status) => ({
      status,
      count: countsByStatusMap.get(status) ?? 0,
    })),
    counts: financeCounts(invoiceSummaryRows, paymentSessionRows),
    totals: financeTotals(invoiceTotalsRows, paymentTotalsRows),
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

function resolveAggregateRange(options: {
  range?: "this_month" | "last_month" | "year_to_date" | "all_time" | "custom"
  from?: string
  to?: string
}) {
  if (options.from || options.to || options.range === "custom") {
    return {
      fromDate: options.from ? new Date(options.from) : undefined,
      toDate: options.to ? new Date(options.to) : undefined,
    }
  }

  const now = new Date()
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()

  if (options.range === "this_month") {
    return {
      fromDate: new Date(Date.UTC(year, month, 1)),
      toDate: new Date(Date.UTC(year, month + 1, 1)),
    }
  }

  if (options.range === "last_month") {
    return {
      fromDate: new Date(Date.UTC(year, month - 1, 1)),
      toDate: new Date(Date.UTC(year, month, 1)),
    }
  }

  if (options.range === "year_to_date") {
    return {
      fromDate: new Date(Date.UTC(year, 0, 1)),
      toDate: undefined,
    }
  }

  return { fromDate: undefined, toDate: undefined }
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

function financeCounts(
  invoiceRows: Array<{ invoiceType: string; status: InvoiceStatus; count: number }>,
  paymentSessionRows: Array<{ status: PaymentSessionStatus; count: number }>,
) {
  const invoiceCount = (invoiceType: InvoiceType, statuses: InvoiceStatus[]) =>
    invoiceRows
      .filter((row) => row.invoiceType === invoiceType && statuses.includes(row.status))
      .reduce((sum, row) => sum + row.count, 0)
  const sessionCount = (statuses: PaymentSessionStatus[]) =>
    paymentSessionRows
      .filter((row) => statuses.includes(row.status))
      .reduce((sum, row) => sum + row.count, 0)

  return {
    invoices: {
      issued: invoiceCount("invoice", ["issued", "partially_paid", "overdue"]),
      paid: invoiceCount("invoice", ["paid"]),
      void: invoiceCount("invoice", ["void"]),
      overdue: invoiceCount("invoice", ["overdue"]),
    },
    proformas: {
      issued: invoiceCount("proforma", ["issued", "partially_paid", "overdue", "paid"]),
      converted: invoiceCount("proforma", ["paid"]),
      void: invoiceCount("proforma", ["void"]),
    },
    paymentSessions: {
      pending: sessionCount(["pending", "requires_redirect", "processing", "authorized"]),
      paid: sessionCount(["paid"]),
      failed: sessionCount(["failed", "cancelled", "expired"]),
    },
  }
}

function financeTotals(
  invoiceRows: Array<{ currency: string; invoiced: number; outstanding: number }>,
  paymentRows: Array<{ currency: string; collected: number; refunded: number }>,
) {
  const currencies = new Set([
    ...invoiceRows.map((row) => row.currency),
    ...paymentRows.map((row) => row.currency),
  ])

  return [...currencies].sort().map((currency) => {
    const invoice = invoiceRows.find((row) => row.currency === currency)
    const payment = paymentRows.find((row) => row.currency === currency)

    return {
      currency,
      invoiced: Number(invoice?.invoiced ?? 0),
      collected: Number(payment?.collected ?? 0),
      outstanding: Number(invoice?.outstanding ?? 0),
      refunded: Number(payment?.refunded ?? 0),
    }
  })
}
