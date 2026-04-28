import { queryOptions } from "@tanstack/react-query"
import type { ChartConfig } from "@voyantjs/ui/components/chart"
import { api } from "@/lib/api-client"

export type BookingRow = {
  id: string
  bookingNumber: string
  status: string
  sellCurrency: string
  sellAmountCents: number | null
  pax: number | null
  startDate: string | null
  createdAt: string
}
export type ProductRow = { id: string; name: string; status: string }
export type SupplierRow = { id: string; name: string }
export type InvoiceRow = {
  id: string
  status: string
  totalAmountCents: number | null
  currency: string
  issuedAt: string | null
  createdAt: string
}

export function getDashboardBookingsQueryOptions() {
  return queryOptions({
    queryKey: ["dashboard-bookings"],
    queryFn: () => api.get<{ data: BookingRow[]; total: number }>("/v1/admin/bookings?limit=100"),
    staleTime: 60_000,
  })
}
export function getDashboardProductsQueryOptions() {
  return queryOptions({
    queryKey: ["dashboard-products"],
    queryFn: () => api.get<{ data: ProductRow[]; total: number }>("/v1/admin/products?limit=100"),
    staleTime: 60_000,
  })
}
export function getDashboardSuppliersQueryOptions() {
  return queryOptions({
    queryKey: ["dashboard-suppliers"],
    queryFn: () => api.get<{ data: SupplierRow[]; total: number }>("/v1/suppliers?limit=100"),
    staleTime: 60_000,
  })
}
export function getDashboardInvoicesQueryOptions() {
  return queryOptions({
    queryKey: ["dashboard-invoices"],
    queryFn: () =>
      api.get<{ data: InvoiceRow[]; total: number }>("/v1/admin/finance/invoices?limit=100"),
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
function getMonthLabel(date: Date): string {
  return date.toLocaleString("en-US", { month: "short" })
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

export function deriveMonthlyRevenue(bookings: BookingRow[]) {
  const now = new Date()
  const months: { month: string; revenue: number; bookings: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({ month: getMonthLabel(date), revenue: 0, bookings: 0 })
  }
  for (const booking of bookings) {
    const entry = months.find((month) => month.month === getMonthLabel(new Date(booking.createdAt)))
    if (entry) {
      entry.bookings += 1
      entry.revenue += (booking.sellAmountCents ?? 0) / 100
    }
  }
  return months
}
export function deriveStatusBreakdown(bookings: BookingRow[]) {
  const counts: Record<string, number> = {}
  for (const booking of bookings) counts[booking.status] = (counts[booking.status] ?? 0) + 1
  return Object.entries(counts).map(([status, count]) => ({
    status,
    count,
    fill: getStatusColor(status),
  }))
}
export function deriveMonthlyBookingCounts(bookings: BookingRow[]) {
  const now = new Date()
  const months: { month: string; count: number }[] = []
  for (let i = 5; i >= 0; i--)
    months.push({
      month: getMonthLabel(new Date(now.getFullYear(), now.getMonth() - i, 1)),
      count: 0,
    })
  for (const booking of bookings) {
    const entry = months.find((month) => month.month === getMonthLabel(new Date(booking.createdAt)))
    if (entry) entry.count += 1
  }
  return months
}
export function deriveUpcomingDepartures(bookings: BookingRow[]) {
  const now = new Date()
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  return bookings
    .filter(
      (booking) =>
        booking.startDate &&
        new Date(booking.startDate) >= now &&
        new Date(booking.startDate) <= thirtyDays &&
        booking.status !== "cancelled",
    )
    .sort((a, b) => new Date(a.startDate!).getTime() - new Date(b.startDate!).getTime())
    .slice(0, 8)
}
