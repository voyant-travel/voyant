import type {
  AgingReportQuery,
  PostgresJsDatabase,
  ProfitabilityQuery,
  RevenueReportQuery,
} from "./service-shared.js"
import { and, asc, bookings, gte, invoices, lte, sql } from "./service-shared.js"

export const financeReportService = {
  getRevenueReport(db: PostgresJsDatabase, query: RevenueReportQuery) {
    return (
      db
        .select({
          month: sql<string>`to_char(date_trunc('month', ${invoices.issueDate}::date), 'YYYY-MM')`,
          totalCents: sql<number>`coalesce(sum(${invoices.totalCents}), 0)::int`,
          count: sql<number>`count(*)::int`,
        })
        .from(invoices)
        .where(and(gte(invoices.issueDate, query.from), lte(invoices.issueDate, query.to)))
        // agent-quality: raw-sql reviewed -- owner: finance; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
        .groupBy(sql`date_trunc('month', ${invoices.issueDate}::date)`)
        // agent-quality: raw-sql reviewed -- owner: finance; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
        .orderBy(sql`date_trunc('month', ${invoices.issueDate}::date)`)
    )
  },

  getAgingReport(db: PostgresJsDatabase, query: AgingReportQuery) {
    const asOf = query.asOf ?? new Date().toISOString().slice(0, 10)

    return db
      .select({
        bucket: sql<string>`
          case
            when ${invoices.dueDate}::date >= ${asOf}::date then 'current'
            when ${asOf}::date - ${invoices.dueDate}::date <= 30 then '1-30'
            when ${asOf}::date - ${invoices.dueDate}::date <= 60 then '31-60'
            when ${asOf}::date - ${invoices.dueDate}::date <= 90 then '61-90'
            else '90+'
          end`,
        totalCents: sql<number>`coalesce(sum(${invoices.balanceDueCents}), 0)::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(invoices)
      .where(
        and(
          // agent-quality: raw-sql reviewed -- owner: finance; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
          sql`${invoices.balanceDueCents} > 0`,
          // agent-quality: raw-sql reviewed -- owner: finance; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
          sql`${invoices.status} != 'void'`,
          // agent-quality: raw-sql reviewed -- owner: finance; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
          sql`${invoices.status} != 'paid'`,
        ),
      )
      .groupBy(sql`1`)
  },

  async getProfitabilityReport(db: PostgresJsDatabase, query: ProfitabilityQuery) {
    const conditions = []

    if (query.from) {
      conditions.push(gte(bookings.startDate, query.from))
    }

    if (query.to) {
      conditions.push(lte(bookings.startDate, query.to))
    }

    return (await db
      .select({
        bookingId: bookings.id,
        bookingNumber: bookings.bookingNumber,
        sellAmountCents: bookings.sellAmountCents,
        costAmountCents: bookings.costAmountCents,
        marginPercent: bookings.marginPercent,
      })
      .from(bookings)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(bookings.startDate), asc(bookings.createdAt))) as Array<{
      bookingId: string
      bookingNumber: string
      sellAmountCents: number | null
      costAmountCents: number | null
      marginPercent: number | null
    }>
  },
}
