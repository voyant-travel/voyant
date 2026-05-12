"use client"

import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useVoyantReactContext } from "@voyantjs/react"
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@voyantjs/ui/components"
import { buttonVariants } from "@voyantjs/ui/components/button"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@voyantjs/ui/components/chart"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@voyantjs/ui/components/empty"
import { Skeleton } from "@voyantjs/ui/components/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@voyantjs/ui/components/tooltip"
import { cn } from "@voyantjs/ui/lib/utils"
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarCheck,
  CalendarPlus,
  ClipboardList,
  DollarSign,
  FileText,
  Package,
  PackagePlus,
  Sparkles,
  Users,
} from "lucide-react"
import type { ReactNode } from "react"
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

import { AdminWidgetSlotRenderer } from "../components/admin-widget-slot.js"
import { formatMessage } from "../lib/i18n.js"
import { useLocale } from "../providers/locale.js"
import { useOperatorAdminMessages } from "../providers/operator-admin-messages.js"
import {
  buildMonthSeries,
  formatCurrency,
  getDashboardBookingsAggregatesQueryOptions,
  getDashboardFinanceAggregatesQueryOptions,
  getDashboardProductsAggregatesQueryOptions,
  getDashboardSuppliersAggregatesQueryOptions,
  getStatusColor,
  pickPrimaryCurrency,
} from "./dashboard-query-options.js"
import {
  DashboardAreaChartSkeleton,
  DashboardBarChartSkeleton,
  DashboardOutstandingInvoicesSkeleton,
  DashboardPieChartSkeleton,
  DashboardUpcomingListSkeleton,
} from "./dashboard-skeleton.js"

export type DashboardEmptyStateKey =
  | "revenueTrend"
  | "bookingStatus"
  | "monthlyBookings"
  | "upcomingDepartures"
  | "outstandingInvoices"
  | "onboarding"

export interface DashboardEmptyAction {
  href: string
  label: string
}

export interface DashboardEmptyStateConfig {
  action?: DashboardEmptyAction | null
  description?: string | null
  icon?: ReactNode
  title?: string | null
}

export interface DashboardPageProps {
  emptyStates?: Partial<Record<DashboardEmptyStateKey, DashboardEmptyStateConfig>>
}

export function DashboardPage({ emptyStates = {} }: DashboardPageProps = {}) {
  const client = useVoyantReactContext()
  const messages = useOperatorAdminMessages()
  const { resolvedLocale } = useLocale()
  const { data: bookingsAggregates, isPending: bookingsPending } = useQuery(
    getDashboardBookingsAggregatesQueryOptions(client),
  )
  const { data: productsAggregates, isPending: productsPending } = useQuery(
    getDashboardProductsAggregatesQueryOptions(client),
  )
  const { data: suppliersAggregates, isPending: suppliersPending } = useQuery(
    getDashboardSuppliersAggregatesQueryOptions(client),
  )
  const { data: financeAggregates, isPending: financePending } = useQuery(
    getDashboardFinanceAggregatesQueryOptions(client),
  )

  const bookings = bookingsAggregates?.data
  const products = productsAggregates?.data
  const suppliers = suppliersAggregates?.data
  const finance = financeAggregates?.data

  const monthSeries = buildMonthSeries()
  const defaultCurrency = pickPrimaryCurrency(bookings?.monthlyRevenue ?? [])

  const monthlyRevenue = monthSeries.map((entry) => {
    const revenue =
      bookings?.monthlyRevenue
        .filter((row) => row.yearMonth === entry.yearMonth)
        .reduce((sum, row) => sum + row.sellAmountCents, 0) ?? 0
    const bookingsInMonth =
      bookings?.monthlyCounts.find((row) => row.yearMonth === entry.yearMonth)?.count ?? 0
    return { month: entry.month, revenue: revenue / 100, bookings: bookingsInMonth }
  })
  const monthlyBookings = monthSeries.map((entry) => ({
    month: entry.month,
    count: bookings?.monthlyCounts.find((row) => row.yearMonth === entry.yearMonth)?.count ?? 0,
  }))

  const totalRevenueCents =
    bookings?.monthlyRevenue
      .filter((row) => row.currency === defaultCurrency)
      .reduce((sum, row) => sum + row.sellAmountCents, 0) ?? 0

  const confirmedBookings =
    (bookings?.countsByStatus.find((row) => row.status === "confirmed")?.count ?? 0) +
    (bookings?.countsByStatus.find((row) => row.status === "in_progress")?.count ?? 0)

  const totalPax = bookings?.totalPax ?? 0
  const activeProducts = products?.active ?? 0
  const totalProducts = products?.total ?? 0
  const totalSuppliers = suppliers?.total ?? 0

  const outstandingInvoiceCount = finance?.outstanding.reduce((sum, row) => sum + row.count, 0) ?? 0
  const outstandingPrimaryCurrency = finance?.outstanding[0]?.currency ?? defaultCurrency
  const outstandingAmount =
    finance?.outstanding.find((row) => row.currency === outstandingPrimaryCurrency)
      ?.balanceDueCents ?? 0
  const outstandingTopN = finance?.outstandingTopN ?? []

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

  const revenueChartConfig = {
    revenue: { label: messages.dashboard.chartRevenueLabel, color: "hsl(221 83% 53%)" },
    bookings: { label: messages.dashboard.chartBookingsLabel, color: "hsl(142 71% 45%)" },
  }
  const bookingStatusConfig = {
    confirmed: { label: messages.dashboard.statusConfirmedLabel, color: "hsl(142 71% 45%)" },
    completed: { label: messages.dashboard.statusCompletedLabel, color: "hsl(221 83% 53%)" },
    in_progress: { label: messages.dashboard.statusInProgressLabel, color: "hsl(47 96% 53%)" },
    draft: { label: messages.dashboard.statusDraftLabel, color: "hsl(215 14% 55%)" },
    cancelled: { label: messages.dashboard.statusCancelledLabel, color: "hsl(0 84% 60%)" },
  }
  const monthlyBookingsConfig = {
    count: { label: messages.dashboard.chartBookingsLabel, color: "hsl(221 83% 53%)" },
  }

  const localizedStatusBreakdown = (bookings?.countsByStatus ?? [])
    .filter((entry) => entry.count > 0)
    .map((entry) => ({
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
      count: entry.count,
      fill: getStatusColor(entry.status),
    }))

  const upcoming = bookings?.upcomingDepartures.items ?? []
  const hasRevenueData = monthlyRevenue.some((entry) => entry.revenue > 0)
  const hasMonthlyBookingsData = monthlyBookings.some((entry) => entry.count > 0)
  const hasBookingStatusData = localizedStatusBreakdown.length > 0
  const hasOutstandingInvoices = outstandingInvoiceCount > 0 || outstandingTopN.length > 0
  const allAggregatesLoaded =
    !bookingsPending && !productsPending && !suppliersPending && !financePending
  const isBrandNewTenant =
    allAggregatesLoaded &&
    (bookings?.total ?? 0) === 0 &&
    (products?.total ?? 0) === 0 &&
    (suppliers?.total ?? 0) === 0 &&
    (finance?.total ?? 0) === 0

  const resolvedEmptyStates = {
    revenueTrend: {
      title: messages.dashboard.revenueTrendEmptyTitle,
      description: messages.dashboard.revenueTrendEmptyDescription,
      action: { href: "/bookings", label: messages.dashboard.revenueTrendEmptyAction },
      icon: <DollarSign className="size-5" />,
      ...emptyStates.revenueTrend,
    },
    bookingStatus: {
      title: messages.dashboard.bookingStatusEmptyTitle,
      description: messages.dashboard.bookingStatusEmptyDescription,
      action: { href: "/bookings", label: messages.dashboard.bookingStatusEmptyAction },
      icon: <ClipboardList className="size-5" />,
      ...emptyStates.bookingStatus,
    },
    monthlyBookings: {
      title: messages.dashboard.monthlyBookingsEmptyTitle,
      description: messages.dashboard.monthlyBookingsEmptyDescription,
      action: { href: "/bookings", label: messages.dashboard.monthlyBookingsEmptyAction },
      icon: <BarChart3 className="size-5" />,
      ...emptyStates.monthlyBookings,
    },
    upcomingDepartures: {
      title: messages.dashboard.noUpcomingDepartures,
      description: messages.dashboard.noUpcomingDeparturesDescription,
      action: null,
      icon: <CalendarCheck className="size-5" />,
      ...emptyStates.upcomingDepartures,
    },
    outstandingInvoices: {
      title: messages.dashboard.outstandingInvoicesEmptyTitle,
      description: messages.dashboard.outstandingInvoicesEmptyDescription,
      action: {
        href: "/finance",
        label: messages.dashboard.outstandingInvoicesEmptyAction,
      },
      icon: <FileText className="size-5" />,
      ...emptyStates.outstandingInvoices,
    },
    onboarding: {
      title: messages.dashboard.onboardingTitle,
      description: messages.dashboard.onboardingDescription,
      icon: <Sparkles className="size-5" />,
      ...emptyStates.onboarding,
    },
  } satisfies Record<DashboardEmptyStateKey, DashboardEmptyStateConfig>

  const dashboardMetrics = {
    totalRevenueCents,
    confirmedBookings,
    totalPax,
    activeProducts,
    outstandingAmount,
    outstandingInvoiceCount,
    defaultCurrency,
  }

  const widgetProps = {
    bookingsAggregates: bookings ?? null,
    productsAggregates: products ?? null,
    suppliersAggregates: suppliers ?? null,
    financeAggregates: finance ?? null,
    metrics: dashboardMetrics,
    emptyStates: resolvedEmptyStates,
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{messages.dashboard.title}</h1>
        <p className="text-sm text-muted-foreground">{messages.dashboard.description}</p>
      </div>
      <AdminWidgetSlotRenderer slot="dashboard.header" props={widgetProps} />
      {isBrandNewTenant ? (
        <>
          <DashboardOnboardingEmptyState emptyState={resolvedEmptyStates.onboarding}>
            <OnboardingAction
              href="/products"
              icon={<PackagePlus className="size-4" />}
              title={messages.dashboard.onboardingProductsTitle}
              description={messages.dashboard.onboardingProductsDescription}
              actionLabel={messages.dashboard.onboardingProductsAction}
            />
            <OnboardingAction
              href="/suppliers"
              icon={<Users className="size-4" />}
              title={messages.dashboard.onboardingSuppliersTitle}
              description={messages.dashboard.onboardingSuppliersDescription}
              actionLabel={messages.dashboard.onboardingSuppliersAction}
            />
            <OnboardingAction
              href="/contacts"
              icon={<Users className="size-4" />}
              title={messages.dashboard.onboardingCustomersTitle}
              description={messages.dashboard.onboardingCustomersDescription}
              actionLabel={messages.dashboard.onboardingCustomersAction}
            />
            <OnboardingAction
              href="/bookings"
              icon={<CalendarPlus className="size-4" />}
              title={messages.dashboard.onboardingBookingsTitle}
              description={messages.dashboard.onboardingBookingsDescription}
              actionLabel={messages.dashboard.onboardingBookingsAction}
            />
          </DashboardOnboardingEmptyState>
          <AdminWidgetSlotRenderer slot="dashboard.footer" props={widgetProps} />
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              title={messages.dashboard.totalRevenueTitle}
              value={formatCurrency(totalRevenueCents, defaultCurrency)}
              description={messages.dashboard.totalRevenueDescription}
              icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
              trend={revenueTrend}
              trendLabel={messages.dashboard.trendVsLastMonth}
              empty={!hasRevenueData}
              emptyLabel={messages.dashboard.metricUnavailable}
              isLoading={bookingsPending}
            />
            <KpiCard
              title={messages.dashboard.activeBookingsTitle}
              value={confirmedBookings.toString()}
              description={formatMessage(messages.dashboard.activeBookingsDescription, {
                count: bookings?.total ?? 0,
              })}
              icon={<CalendarCheck className="h-4 w-4 text-muted-foreground" />}
              trend={bookingTrend}
              trendLabel={messages.dashboard.trendVsLastMonth}
              empty={(bookings?.total ?? 0) === 0}
              emptyLabel={messages.dashboard.metricUnavailable}
              isLoading={bookingsPending}
            />
            <KpiCard
              title={messages.dashboard.totalTravelersTitle}
              value={totalPax.toLocaleString()}
              description={messages.dashboard.totalTravelersDescription}
              icon={<Users className="h-4 w-4 text-muted-foreground" />}
              empty={totalPax === 0 && (bookings?.total ?? 0) === 0}
              emptyLabel={messages.dashboard.metricUnavailable}
              isLoading={bookingsPending}
            />
            <KpiCard
              title={messages.dashboard.activeProductsTitle}
              value={activeProducts.toString()}
              description={formatMessage(messages.dashboard.activeProductsDescription, {
                products: totalProducts,
                suppliers: totalSuppliers,
              })}
              icon={<Package className="h-4 w-4 text-muted-foreground" />}
              empty={activeProducts === 0 && totalProducts === 0}
              emptyLabel={messages.dashboard.metricUnavailable}
              isLoading={productsPending || suppliersPending}
            />
          </div>
          <AdminWidgetSlotRenderer slot="dashboard.after-kpis" props={widgetProps} />

          <div className="grid gap-4 lg:grid-cols-7">
            <Card className="lg:col-span-4">
              <CardHeader>
                <CardTitle>{messages.dashboard.revenueTrendTitle}</CardTitle>
                <CardDescription>{messages.dashboard.revenueTrendDescription}</CardDescription>
              </CardHeader>
              <CardContent>
                {bookingsPending ? (
                  <DashboardAreaChartSkeleton />
                ) : !hasRevenueData ? (
                  <DashboardEmptyState emptyState={resolvedEmptyStates.revenueTrend} />
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
                ) : !hasBookingStatusData ? (
                  <DashboardEmptyState emptyState={resolvedEmptyStates.bookingStatus} />
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
                ) : !hasMonthlyBookingsData ? (
                  <DashboardEmptyState emptyState={resolvedEmptyStates.monthlyBookings} compact />
                ) : (
                  <ChartContainer config={monthlyBookingsConfig} className="h-[250px] w-full">
                    <BarChart
                      data={monthlyBookings}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        allowDecimals={false}
                      />
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
                  <CardDescription>
                    {messages.dashboard.upcomingDeparturesDescription}
                  </CardDescription>
                </div>
                <Link to="/bookings" className="text-sm text-primary hover:underline">
                  {messages.dashboard.viewAll}
                </Link>
              </CardHeader>
              <CardContent>
                {bookingsPending ? (
                  <DashboardUpcomingListSkeleton />
                ) : upcoming.length === 0 ? (
                  <DashboardEmptyState
                    emptyState={resolvedEmptyStates.upcomingDepartures}
                    compact
                  />
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
                          <span className="text-sm font-medium">
                            {booking.bookingNumber ?? booking.id.slice(0, 8)}
                          </span>
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
                              {formatCurrency(
                                booking.sellAmountCents,
                                booking.sellCurrency ?? defaultCurrency,
                              )}
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
                <CardDescription>
                  {messages.dashboard.outstandingInvoicesDescription}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {financePending ? (
                  <DashboardOutstandingInvoicesSkeleton />
                ) : !hasOutstandingInvoices ? (
                  <DashboardEmptyState emptyState={resolvedEmptyStates.outstandingInvoices} />
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg border border-dashed p-4">
                      <div>
                        <p className="text-sm font-medium">
                          {messages.dashboard.outstandingTotalTitle}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatMessage(messages.dashboard.outstandingInvoicesDue, {
                            count: outstandingInvoiceCount,
                          })}
                        </p>
                      </div>
                      <p className="text-lg font-semibold">
                        {formatCurrency(outstandingAmount, outstandingPrimaryCurrency)}
                      </p>
                    </div>
                    {outstandingTopN.map((invoice) => (
                      <div
                        key={invoice.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium">
                            {invoice.invoiceNumber ?? invoice.id.slice(0, 8)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {invoice.dueDate
                              ? new Date(invoice.dueDate).toLocaleDateString(resolvedLocale, {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : invoice.issueDate
                                ? new Date(invoice.issueDate).toLocaleDateString(resolvedLocale, {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })
                                : messages.dashboard.noIssueDate}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {formatCurrency(invoice.balanceDueCents, invoice.currency)}
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
          <AdminWidgetSlotRenderer slot="dashboard.footer" props={widgetProps} />
        </>
      )}
    </div>
  )
}

function DashboardEmptyState({
  compact = false,
  emptyState,
}: {
  compact?: boolean
  emptyState: DashboardEmptyStateConfig
}) {
  const action = emptyState.action ?? null

  return (
    <Empty className={cn("min-h-[250px] border", compact && "min-h-[180px] p-8")}>
      <EmptyHeader>
        {emptyState.icon ? <EmptyMedia variant="icon">{emptyState.icon}</EmptyMedia> : null}
        {emptyState.title ? <EmptyTitle>{emptyState.title}</EmptyTitle> : null}
        {emptyState.description ? (
          <EmptyDescription>{emptyState.description}</EmptyDescription>
        ) : null}
      </EmptyHeader>
      {action ? (
        <EmptyContent>
          <a href={action.href} className={cn(buttonVariants({ size: "sm" }))}>
            {action.label}
          </a>
        </EmptyContent>
      ) : null}
    </Empty>
  )
}

function DashboardOnboardingEmptyState({
  children,
  emptyState,
}: {
  children: ReactNode
  emptyState: DashboardEmptyStateConfig
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <Empty className="border p-6">
          <EmptyHeader>
            {emptyState.icon ? <EmptyMedia variant="icon">{emptyState.icon}</EmptyMedia> : null}
            {emptyState.title ? <EmptyTitle>{emptyState.title}</EmptyTitle> : null}
            {emptyState.description ? (
              <EmptyDescription>{emptyState.description}</EmptyDescription>
            ) : null}
          </EmptyHeader>
          <div className="grid w-full gap-3 md:grid-cols-2">{children}</div>
        </Empty>
      </CardContent>
    </Card>
  )
}

function OnboardingAction({
  actionLabel,
  description,
  href,
  icon,
  title,
}: {
  actionLabel: string
  description: string
  href: string
  icon: ReactNode
  title: string
}) {
  return (
    <a
      href={href}
      className="flex min-w-0 items-start justify-between gap-4 rounded-lg border bg-background p-4 text-left transition-colors hover:bg-muted/50"
    >
      <span className="flex min-w-0 gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          {icon}
        </span>
        <span className="min-w-0 space-y-1">
          <span className="block text-sm font-medium">{title}</span>
          <span className="block text-sm text-muted-foreground">{description}</span>
        </span>
      </span>
      <span className="shrink-0 text-sm font-medium text-primary">{actionLabel}</span>
    </a>
  )
}

function KpiCard({
  title,
  value,
  description,
  icon,
  trend,
  trendLabel,
  empty,
  emptyLabel,
  isLoading,
}: {
  title: string
  value: string
  description: string
  icon: ReactNode
  trend?: number
  trendLabel?: string
  empty?: boolean
  emptyLabel?: string
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
            {empty ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger
                    className="text-2xl font-semibold tracking-tight text-muted-foreground"
                    aria-label={emptyLabel ?? description}
                  >
                    —
                  </TooltipTrigger>
                  <TooltipContent>{emptyLabel ?? description}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <div className="text-2xl font-semibold tracking-tight">{value}</div>
            )}
            <p className="text-xs text-muted-foreground">{description}</p>
            {!empty && trend != null && trendLabel ? (
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
