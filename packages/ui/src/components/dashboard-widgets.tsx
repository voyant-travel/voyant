import type * as React from "react"
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "./card.js"
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "./chart.js"
import { Skeleton } from "./skeleton.js"

const monthLabelFormatter = new Intl.DateTimeFormat(undefined, { month: "short" })

const monthlyBookingsChartConfig = {
  bookings: {
    label: "Bookings",
    color: "var(--color-chart-2)",
  },
} satisfies ChartConfig

type DashboardIcon = React.ComponentType<{ className?: string }>

export interface DashboardStatusRow {
  status: string
  count: number
}

export interface DashboardMonthPoint {
  month: string
  count: number
}

export interface DashboardCurrencyBreakdown {
  currency: string
  count: number
  totalCents: number
}

export interface DashboardRevenuePoint {
  month: string
  totalCents: number
}

export interface DashboardRevenueSeries {
  currency: string
  totalCents: number
  points: DashboardRevenuePoint[]
}

function formatMonthLabel(month: string) {
  return monthLabelFormatter.format(new Date(`${month}-01T00:00:00Z`))
}

function formatCurrency(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

function formatBookingStatus(status: string) {
  return status.replace(/_/g, " ")
}

function buildRevenueChartConfig(currency: string): ChartConfig {
  return {
    revenue: {
      label: currency,
      color: "var(--color-chart-3)",
    },
  }
}

function SectionSkeleton({ height = "h-72" }: { height?: string }) {
  return <Skeleton className={`w-full ${height}`} />
}

export function DashboardStatCard({
  title,
  value,
  description,
  icon: Icon,
  isLoading,
  isError,
}: {
  title: string
  value: number | string | undefined
  description: string
  icon: DashboardIcon
  isLoading: boolean
  isError: boolean
}) {
  return (
    <Card size="sm">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-1">
        {isLoading ? (
          <Skeleton className="h-8 w-20" />
        ) : isError ? (
          <div className="text-2xl font-semibold tracking-tight text-muted-foreground">—</div>
        ) : (
          <div className="text-2xl font-semibold tracking-tight">{value ?? 0}</div>
        )}
        <p className="text-xs text-muted-foreground">{isError ? "Failed to load" : description}</p>
      </CardContent>
    </Card>
  )
}

export function BookingStatusWidget({
  rows,
  isLoading,
  isError,
  title = "Booking Status",
  description = "Current booking mix across the workspace.",
}: {
  rows: DashboardStatusRow[]
  isLoading: boolean
  isError: boolean
  title?: string
  description?: string
}) {
  const maxCount = rows.reduce((max, row) => Math.max(max, row.count), 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <SectionSkeleton height="h-64" />
        ) : isError ? (
          <p className="text-sm text-muted-foreground">Failed to load booking status aggregates.</p>
        ) : (
          <div className="space-y-4">
            {rows.map((row) => {
              const width = maxCount > 0 ? `${(row.count / maxCount) * 100}%` : "0%"
              return (
                <div key={row.status} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="capitalize text-muted-foreground">
                      {formatBookingStatus(row.status)}
                    </span>
                    <span className="font-mono text-foreground">{row.count.toLocaleString()}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-foreground/70 transition-[width]"
                      style={{ width }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function MonthlyBookingsWidget({
  points,
  isLoading,
  isError,
  title = "Monthly Bookings",
  description = "Booking creation trend across the last six months.",
}: {
  points: DashboardMonthPoint[]
  isLoading: boolean
  isError: boolean
  title?: string
  description?: string
}) {
  const chartData = points.map((point) => ({
    month: formatMonthLabel(point.month),
    bookings: point.count,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <SectionSkeleton />
        ) : isError ? (
          <p className="text-sm text-muted-foreground">
            Failed to load monthly booking aggregates.
          </p>
        ) : (
          <ChartContainer config={monthlyBookingsChartConfig} className="h-72 w-full">
            <BarChart data={chartData} accessibilityLayer>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <Bar dataKey="bookings" fill="var(--color-bookings)" radius={[10, 10, 4, 4]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

export function RevenueWidget({
  series,
  isLoading,
  isError,
  title = "Revenue",
  description = "Issued invoice totals over the last six months.",
  emptyMessage = "No invoice revenue recorded yet.",
}: {
  series: DashboardRevenueSeries | undefined
  isLoading: boolean
  isError: boolean
  title?: string
  description?: string
  emptyMessage?: string
}) {
  const chartData =
    series?.points.map((point) => ({
      month: formatMonthLabel(point.month),
      revenue: point.totalCents / 100,
    })) ?? []
  const config = buildRevenueChartConfig(series?.currency ?? title)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-4 text-base">
          <span>
            {title} · {series?.currency ?? "—"}
          </span>
          {!isLoading && !isError && series ? (
            <span className="font-mono text-sm text-muted-foreground">
              {formatCurrency(series.totalCents, series.currency)}
            </span>
          ) : null}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <SectionSkeleton height="h-64" />
        ) : isError ? (
          <p className="text-sm text-muted-foreground">Failed to load revenue aggregates.</p>
        ) : !series ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <ChartContainer config={config} className="h-64 w-full">
            <LineChart data={chartData} accessibilityLayer>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} width={48} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <Line
                dataKey="revenue"
                type="monotone"
                stroke="var(--color-revenue)"
                strokeWidth={2.5}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

export function OutstandingInvoicesWidget({
  rows,
  isLoading,
  isError,
  title = "Outstanding Receivables",
  description = "Open invoice balances grouped by currency.",
  emptyMessage = "No outstanding invoices.",
}: {
  rows: DashboardCurrencyBreakdown[]
  isLoading: boolean
  isError: boolean
  title?: string
  description?: string
  emptyMessage?: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <SectionSkeleton height="h-64" />
        ) : isError ? (
          <p className="text-sm text-muted-foreground">Failed to load receivables.</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div
                key={row.currency}
                className="flex items-center justify-between gap-4 rounded-lg border border-border/70 px-4 py-3"
              >
                <div className="space-y-1">
                  <div className="text-sm font-medium">{row.currency}</div>
                  <p className="text-xs text-muted-foreground">
                    {row.count.toLocaleString()} open invoice{row.count === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="text-right font-mono text-sm">
                  {formatCurrency(row.totalCents, row.currency)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
