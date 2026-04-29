import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { formatMessage, useLocale } from "@voyantjs/admin"
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@voyantjs/ui/components"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@voyantjs/ui/components/chart"
import { Skeleton } from "@voyantjs/ui/components/skeleton"
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarCheck,
  DollarSign,
  Package,
  Users,
} from "lucide-react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"
import { AdminWidgetSlotRenderer } from "@/components/admin/admin-widget-slot"
import { useAdminMessages } from "@/lib/admin-i18n"
import {
  deriveMonthlyBookingCounts,
  deriveMonthlyRevenue,
  deriveStatusBreakdown,
  deriveUpcomingDepartures,
  formatCurrency,
  getDashboardBookingsQueryOptions,
  getDashboardInvoicesQueryOptions,
  getDashboardProductsQueryOptions,
  getDashboardSuppliersQueryOptions,
  getStatusColor,
} from "./dashboard-shared"
import {
  DashboardAreaChartSkeleton,
  DashboardBarChartSkeleton,
  DashboardOutstandingInvoicesSkeleton,
  DashboardPieChartSkeleton,
  DashboardUpcomingListSkeleton,
} from "./dashboard-skeleton"

export function DashboardPage() {
  const messages = useAdminMessages()
  const { resolvedLocale } = useLocale()
  const { data: bookingsData, isPending: bookingsPending } = useQuery(
    getDashboardBookingsQueryOptions(),
  )
  const { data: productsData, isPending: productsPending } = useQuery(
    getDashboardProductsQueryOptions(),
  )
  const { data: suppliersData, isPending: suppliersPending } = useQuery(
    getDashboardSuppliersQueryOptions(),
  )
  const { data: invoicesData, isPending: invoicesPending } = useQuery(
    getDashboardInvoicesQueryOptions(),
  )

  const bookings = bookingsData?.data ?? []
  const products = productsData?.data ?? []
  const suppliers = suppliersData?.data ?? []
  const invoices = invoicesData?.data ?? []
  const totalRevenue = bookings.reduce((sum, booking) => sum + (booking.sellAmountCents ?? 0), 0)
  const confirmedBookings = bookings.filter(
    (booking) => booking.status === "confirmed" || booking.status === "in_progress",
  ).length
  const totalPax = bookings.reduce((sum, booking) => sum + (booking.pax ?? 0), 0)
  const activeProducts = products.filter(
    (product) => product.status === "active" || product.status === "published",
  ).length
  const outstandingInvoices = invoices.filter(
    (invoice) =>
      invoice.status === "issued" || invoice.status === "sent" || invoice.status === "overdue",
  )
  const outstandingAmount = outstandingInvoices.reduce(
    (sum, invoice) => sum + (invoice.totalAmountCents ?? 0),
    0,
  )
  const monthlyRevenue = deriveMonthlyRevenue(bookings)
  const statusBreakdown = deriveStatusBreakdown(bookings)
  const monthlyBookings = deriveMonthlyBookingCounts(bookings)
  const upcoming = deriveUpcomingDepartures(bookings)
  const currentMonthRevenue = monthlyRevenue[monthlyRevenue.length - 1]?.revenue ?? 0
  const prevMonthRevenue = monthlyRevenue[monthlyRevenue.length - 2]?.revenue ?? 0
  const revenueTrend =
    prevMonthRevenue > 0 ? ((currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100 : 0
  const currentMonthBookings = monthlyBookings[monthlyBookings.length - 1]?.count ?? 0
  const prevMonthBookings = monthlyBookings[monthlyBookings.length - 2]?.count ?? 0
  const bookingTrend =
    prevMonthBookings > 0
      ? ((currentMonthBookings - prevMonthBookings) / prevMonthBookings) * 100
      : 0
  const defaultCurrency = bookings[0]?.sellCurrency ?? "USD"
  const revenueChartConfig = {
    revenue: {
      label: messages.dashboard.chartRevenueLabel,
      color: "hsl(221 83% 53%)",
    },
    bookings: {
      label: messages.dashboard.chartBookingsLabel,
      color: "hsl(142 71% 45%)",
    },
  }
  const bookingStatusConfig = {
    confirmed: {
      label: messages.dashboard.statusConfirmedLabel,
      color: "hsl(142 71% 45%)",
    },
    completed: {
      label: messages.dashboard.statusCompletedLabel,
      color: "hsl(221 83% 53%)",
    },
    in_progress: {
      label: messages.dashboard.statusInProgressLabel,
      color: "hsl(47 96% 53%)",
    },
    draft: {
      label: messages.dashboard.statusDraftLabel,
      color: "hsl(215 14% 55%)",
    },
    cancelled: {
      label: messages.dashboard.statusCancelledLabel,
      color: "hsl(0 84% 60%)",
    },
  }
  const monthlyBookingsConfig = {
    count: {
      label: messages.dashboard.chartBookingsLabel,
      color: "hsl(221 83% 53%)",
    },
  }
  const localizedStatusBreakdown = statusBreakdown.map((entry) => ({
    ...entry,
    status:
      entry.status === "confirmed"
        ? messages.dashboard.statusConfirmedLabel
        : entry.status === "completed"
          ? messages.dashboard.statusCompletedLabel
          : entry.status === "in_progress"
            ? messages.dashboard.statusInProgressLabel
            : entry.status === "draft"
              ? messages.dashboard.statusDraftLabel
              : entry.status === "cancelled"
                ? messages.dashboard.statusCancelledLabel
                : entry.status,
    fill: getStatusColor(entry.status),
  }))
  const dashboardMetrics = {
    totalRevenue,
    confirmedBookings,
    totalPax,
    activeProducts,
    outstandingAmount,
    outstandingInvoiceCount: outstandingInvoices.length,
    defaultCurrency,
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{messages.dashboard.title}</h1>
        <p className="text-sm text-muted-foreground">{messages.dashboard.description}</p>
      </div>
      <AdminWidgetSlotRenderer
        slot="dashboard.header"
        props={{ bookings, invoices, products, suppliers, metrics: dashboardMetrics }}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title={messages.dashboard.totalRevenueTitle}
          value={formatCurrency(totalRevenue, defaultCurrency)}
          description={messages.dashboard.totalRevenueDescription}
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
          trend={revenueTrend}
          trendLabel={messages.dashboard.trendVsLastMonth}
          isLoading={bookingsPending}
        />
        <KpiCard
          title={messages.dashboard.activeBookingsTitle}
          value={confirmedBookings.toString()}
          description={formatMessage(messages.dashboard.activeBookingsDescription, {
            count: bookings.length,
          })}
          icon={<CalendarCheck className="h-4 w-4 text-muted-foreground" />}
          trend={bookingTrend}
          trendLabel={messages.dashboard.trendVsLastMonth}
          isLoading={bookingsPending}
        />
        <KpiCard
          title={messages.dashboard.totalTravelersTitle}
          value={totalPax.toLocaleString()}
          description={messages.dashboard.totalTravelersDescription}
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
          isLoading={bookingsPending}
        />
        <KpiCard
          title={messages.dashboard.activeProductsTitle}
          value={activeProducts.toString()}
          description={formatMessage(messages.dashboard.activeProductsDescription, {
            products: products.length,
            suppliers: suppliers.length,
          })}
          icon={<Package className="h-4 w-4 text-muted-foreground" />}
          isLoading={productsPending || suppliersPending}
        />
      </div>
      <AdminWidgetSlotRenderer
        slot="dashboard.after-kpis"
        props={{ bookings, invoices, products, suppliers, metrics: dashboardMetrics }}
      />

      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>{messages.dashboard.revenueTrendTitle}</CardTitle>
            <CardDescription>{messages.dashboard.revenueTrendDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            {bookingsPending ? (
              <DashboardAreaChartSkeleton />
            ) : (
              <ChartContainer config={revenueChartConfig} className="h-[300px] w-full">
                <AreaChart
                  data={monthlyRevenue}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(221 83% 53%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(221 83% 53%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value: number) => `$${(value / 1000).toFixed(0)}k`}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) =>
                          typeof value === "number"
                            ? formatCurrency(value * 100, defaultCurrency)
                            : String(value)
                        }
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(221 83% 53%)"
                    fill="url(#fillRevenue)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>{messages.dashboard.bookingStatusTitle}</CardTitle>
            <CardDescription>{messages.dashboard.bookingStatusDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            {bookingsPending ? (
              <DashboardPieChartSkeleton />
            ) : (
              <ChartContainer config={bookingStatusConfig} className="mx-auto h-[300px] w-full">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="status" hideLabel />} />
                  <Pie
                    data={localizedStatusBreakdown}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                  >
                    {localizedStatusBreakdown.map((entry) => (
                      <Cell key={entry.status} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartLegend content={<ChartLegendContent nameKey="status" />} />
                </PieChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>{messages.dashboard.monthlyBookingsTitle}</CardTitle>
            <CardDescription>{messages.dashboard.monthlyBookingsDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            {bookingsPending ? (
              <DashboardBarChartSkeleton />
            ) : (
              <ChartContainer config={monthlyBookingsConfig} className="h-[250px] w-full">
                <BarChart
                  data={monthlyBookings}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="hsl(221 83% 53%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{messages.dashboard.upcomingDeparturesTitle}</CardTitle>
              <CardDescription>{messages.dashboard.upcomingDeparturesDescription}</CardDescription>
            </div>
            <Link to="/bookings" className="text-sm text-primary hover:underline">
              {messages.dashboard.viewAll}
            </Link>
          </CardHeader>
          <CardContent>
            {bookingsPending ? (
              <DashboardUpcomingListSkeleton />
            ) : upcoming.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {messages.dashboard.noUpcomingDepartures}
              </p>
            ) : (
              <div className="space-y-3">
                {upcoming.map((booking) => (
                  <Link
                    key={booking.id}
                    to="/bookings/$id"
                    params={{ id: booking.id }}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{booking.bookingNumber}</span>
                      <span className="text-xs text-muted-foreground">
                        {booking.startDate
                          ? new Date(booking.startDate).toLocaleDateString(resolvedLocale, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : messages.dashboard.noDate}
                        {booking.pax
                          ? ` · ${formatMessage(messages.dashboard.paxCount, {
                              count: booking.pax,
                            })}`
                          : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {booking.sellAmountCents != null && (
                        <span className="text-sm font-medium tabular-nums">
                          {formatCurrency(booking.sellAmountCents, booking.sellCurrency)}
                        </span>
                      )}
                      <Badge variant="outline" className="capitalize">
                        {booking.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{messages.dashboard.outstandingInvoicesTitle}</CardTitle>
            <CardDescription>{messages.dashboard.outstandingInvoicesDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            {invoicesPending ? (
              <DashboardOutstandingInvoicesSkeleton />
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-dashed p-4">
                  <div>
                    <p className="text-sm font-medium">
                      {messages.dashboard.outstandingTotalTitle}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatMessage(messages.dashboard.outstandingInvoicesDue, {
                        count: outstandingInvoices.length,
                      })}
                    </p>
                  </div>
                  <p className="text-lg font-semibold">
                    {formatCurrency(outstandingAmount, invoices[0]?.currency ?? "USD")}
                  </p>
                </div>
                {outstandingInvoices.slice(0, 5).map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{invoice.id.slice(0, 8)}</span>
                      <span className="text-xs text-muted-foreground">
                        {invoice.issuedAt
                          ? new Date(invoice.issuedAt).toLocaleDateString(resolvedLocale, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : messages.dashboard.noIssueDate}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {formatCurrency(invoice.totalAmountCents ?? 0, invoice.currency)}
                      </span>
                      <Badge variant="secondary" className="capitalize">
                        {invoice.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <AdminWidgetSlotRenderer
        slot="dashboard.footer"
        props={{ bookings, invoices, products, suppliers, metrics: dashboardMetrics }}
      />
    </div>
  )
}

function KpiCard({
  title,
  value,
  description,
  icon,
  trend,
  trendLabel,
  isLoading,
}: {
  title: string
  value: string
  description: string
  icon: React.ReactNode
  trend?: number
  trendLabel?: string
  isLoading?: boolean
}) {
  const isPositive = (trend ?? 0) >= 0

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-3 w-40" />
            {trendLabel ? <Skeleton className="mt-3 h-5 w-28 rounded-full" /> : null}
          </div>
        ) : (
          <>
            <div className="text-2xl font-semibold tracking-tight">{value}</div>
            <p className="text-xs text-muted-foreground">{description}</p>
            {trend != null && trendLabel ? (
              <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                    isPositive
                      ? "bg-emerald-500/10 text-emerald-600"
                      : "bg-rose-500/10 text-rose-600"
                  }`}
                >
                  {isPositive ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {Math.abs(trend).toFixed(1)}%
                </span>
                <span>{trendLabel}</span>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}
