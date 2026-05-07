import { queryOptions } from "@tanstack/react-query"
import type { ChartConfig } from "@voyantjs/ui/components/chart"
import { api } from "@/lib/api-client"

/**
 * Server aggregate shapes (mirror @voyantjs/bookings,
 * @voyantjs/finance, @voyantjs/products, @voyantjs/suppliers).
 *
 * The dashboard now consumes pre-aggregated counts/sums + bounded
 * row slices instead of pulling 100-row pages and deriving KPIs
 * client-side. See #437 for context.
 */

export type BookingsAggregates = {
  total: number
  totalPax: number
  countsByStatus: Array<{ status: string; count: number }>
  monthlyCounts: Array<{ yearMonth: string; count: number }>
  monthlyRevenue: Array<{ yearMonth: string; currency: string; sellAmountCents: number }>
  upcomingDepartures: {
    count: number
    items: Array<{
      id: string
      bookingNumber: string | null
      status: string
      startDate: string | null
      endDate: string | null
      pax: number | null
      sellCurrency: string | null
      sellAmountCents: number | null
    }>
  }
}

export type ProductsAggregates = {
  total: number
  active: number
  publicActive: number
  countsByStatus: Array<{ status: string; count: number }>
  monthlyCreatedCounts: Array<{ yearMonth: string; count: number }>
}

export type SuppliersAggregates = {
  total: number
  active: number
  countsByStatus: Array<{ status: string; count: number }>
  countsByType: Array<{ type: string | null; count: number }>
}

export type FinanceAggregates = {
  total: number
  countsByStatus: Array<{ status: string; count: number }>
  monthlyRevenue: Array<{ yearMonth: string; currency: string; totalCents: number }>
  monthlyInvoiceCounts: Array<{ yearMonth: string; count: number }>
  outstanding: Array<{ currency: string; balanceDueCents: number; count: number }>
  overdue: Array<{ currency: string; balanceDueCents: number; count: number }>
  outstandingTopN: Array<{
    id: string
    invoiceNumber: string | null
    bookingId: string | null
    status: string
    currency: string
    totalCents: number
    balanceDueCents: number
    issueDate: string | null
    dueDate: string | null
  }>
}

/**
 * Six-month window anchored at the start of the current month minus
 * five months. Time window is hard-coded today; making it
 * configurable is a follow-up. The aggregates endpoints accept
 * `from`/`to` so the dashboard just constructs the request.
 */
function buildSixMonthWindow() {
  const now = new Date()
  const fromDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1, 0, 0, 0, 0))
  return { from: fromDate.toISOString() }
}

export function getDashboardBookingsAggregatesQueryOptions() {
  const { from } = buildSixMonthWindow()
  return queryOptions({
    queryKey: ["dashboard-bookings-aggregates", from],
    queryFn: () =>
      api.get<{ data: BookingsAggregates }>(
        `/v1/admin/bookings/aggregates?from=${encodeURIComponent(from)}&upcomingLimit=8`,
      ),
    staleTime: 60_000,
  })
}

export function getDashboardProductsAggregatesQueryOptions() {
  return queryOptions({
    queryKey: ["dashboard-products-aggregates"],
    queryFn: () => api.get<{ data: ProductsAggregates }>("/v1/admin/products/aggregates"),
    staleTime: 60_000,
  })
}

export function getDashboardSuppliersAggregatesQueryOptions() {
  return queryOptions({
    queryKey: ["dashboard-suppliers-aggregates"],
    queryFn: () => api.get<{ data: SuppliersAggregates }>("/v1/admin/suppliers/aggregates"),
    staleTime: 60_000,
  })
}

export function getDashboardFinanceAggregatesQueryOptions() {
  const { from } = buildSixMonthWindow()
  return queryOptions({
    queryKey: ["dashboard-finance-aggregates", from],
    queryFn: () =>
      api.get<{ data: FinanceAggregates }>(
        `/v1/admin/finance/aggregates?from=${encodeURIComponent(from)}&outstandingTopLimit=5`,
      ),
    staleTime: 60_000,
  })
}

export function formatCurrency(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    confirmed: "var(--color-chart-1, hsl(142 71% 45%))",
    completed: "var(--color-chart-2, hsl(221 83% 53%))",
    in_progress: "var(--color-chart-3, hsl(47 96% 53%))",
    draft: "var(--color-chart-4, hsl(215 14% 55%))",
    cancelled: "var(--color-chart-5, hsl(0 84% 60%))",
  }
  return map[status] ?? "hsl(215 14% 55%)"
}

export const revenueChartConfig = {
  revenue: { label: "Revenue", color: "hsl(221 83% 53%)" },
  bookings: { label: "Bookings", color: "hsl(142 71% 45%)" },
} satisfies ChartConfig

export const bookingStatusConfig = {
  confirmed: { label: "Confirmed", color: "hsl(142 71% 45%)" },
  completed: { label: "Completed", color: "hsl(221 83% 53%)" },
  in_progress: { label: "In Progress", color: "hsl(47 96% 53%)" },
  draft: { label: "Draft", color: "hsl(215 14% 55%)" },
  cancelled: { label: "Cancelled", color: "hsl(0 84% 60%)" },
} satisfies ChartConfig

export const monthlyBookingsConfig = {
  count: { label: "Bookings", color: "hsl(221 83% 53%)" },
} satisfies ChartConfig

/**
 * Builds a six-month series anchored at the current month going
 * back five months. Each entry gets a short English label
 * ("Jan"/"Feb"/...) and a `yearMonth` key for joining server rows.
 */
export function buildMonthSeries() {
  const now = new Date()
  return Array.from({ length: 6 }, (_, idx) => {
    const offset = 5 - idx
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1))
    return {
      yearMonth: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
      month: date.toLocaleString("en-US", { month: "short", timeZone: "UTC" }),
    }
  })
}

/**
 * Picks the dominant currency in the booking aggregates' revenue
 * rows by summing across months. Falls back to USD when there's no
 * revenue. The dashboard renders a single-currency headline; richer
 * multi-currency display is a follow-up.
 */
export function pickPrimaryCurrency(
  rows: Array<{ currency: string; sellAmountCents: number }>,
): string {
  if (rows.length === 0) return "USD"
  const totals = new Map<string, number>()
  for (const row of rows) {
    totals.set(row.currency, (totals.get(row.currency) ?? 0) + row.sellAmountCents)
  }
  let bestCurrency = "USD"
  let bestTotal = -1
  for (const [currency, total] of totals) {
    if (total > bestTotal) {
      bestCurrency = currency
      bestTotal = total
    }
  }
  return bestCurrency
}
