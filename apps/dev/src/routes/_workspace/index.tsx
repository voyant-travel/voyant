import { queryOptions, useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
  BookingStatusWidget,
  DashboardStatCard,
  MonthlyBookingsWidget,
  OutstandingInvoicesWidget,
  RevenueWidget,
} from "@voyantjs/ui/components/dashboard-widgets"
import {
  BarChart3,
  Building2,
  CalendarCheck,
  Clock3,
  DollarSign,
  Package,
  PlaneTakeoff,
  Receipt,
  UserRound,
  Users,
} from "lucide-react"

import type { DashboardSummary } from "@/api/dashboard-summary"
import { TypographyH1, TypographyLead } from "@/components/ui/typography"
import { api } from "@/lib/api-client"

export const Route = createFileRoute("/_workspace/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(getDashboardSummaryQueryOptions()),
  component: Dashboard,
})

function getDashboardSummaryQueryOptions() {
  return queryOptions({
    queryKey: ["dashboard-summary"],
    queryFn: () => api.get<DashboardSummary>("/v1/dashboard/summary"),
  })
}

function useDashboardSummary() {
  return useQuery(getDashboardSummaryQueryOptions())
}

function Dashboard() {
  const summary = useDashboardSummary()
  const revenueSeries = summary.data?.revenueByCurrency.slice(0, 2) ?? []
  const outstandingCurrencies = summary.data?.outstandingInvoices.byCurrency.length ?? 0

  return (
    <div className="flex flex-1 flex-col gap-8 p-6 md:p-8">
      <header className="space-y-1">
        <TypographyH1 className="text-2xl">Dashboard</TypographyH1>
        <TypographyLead className="text-sm">
          Server-side aggregates for bookings, revenue, departures, and receivables.
        </TypographyLead>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <DashboardStatCard
          title="People"
          value={summary.data?.counts.people}
          description="People in your CRM"
          icon={UserRound}
          isLoading={summary.isLoading}
          isError={summary.isError}
        />
        <DashboardStatCard
          title="Organizations"
          value={summary.data?.counts.organizations}
          description="Companies in your CRM"
          icon={Users}
          isLoading={summary.isLoading}
          isError={summary.isError}
        />
        <DashboardStatCard
          title="Bookings"
          value={summary.data?.counts.bookings}
          description="All bookings on file"
          icon={CalendarCheck}
          isLoading={summary.isLoading}
          isError={summary.isError}
        />
        <DashboardStatCard
          title="Confirmed"
          value={summary.data?.counts.confirmedBookings}
          description="Bookings ready to operate"
          icon={Clock3}
          isLoading={summary.isLoading}
          isError={summary.isError}
        />
        <DashboardStatCard
          title="Suppliers"
          value={summary.data?.counts.suppliers}
          description="Supplier accounts"
          icon={Building2}
          isLoading={summary.isLoading}
          isError={summary.isError}
        />
        <DashboardStatCard
          title="Products"
          value={summary.data?.counts.products}
          description="Catalog inventory"
          icon={Package}
          isLoading={summary.isLoading}
          isError={summary.isError}
        />
        <DashboardStatCard
          title="Live Products"
          value={summary.data?.counts.liveProducts}
          description="Active and activated"
          icon={BarChart3}
          isLoading={summary.isLoading}
          isError={summary.isError}
        />
        <DashboardStatCard
          title="Invoices"
          value={summary.data?.counts.invoices}
          description="Issued invoice records"
          icon={DollarSign}
          isLoading={summary.isLoading}
          isError={summary.isError}
        />
        <DashboardStatCard
          title="Outstanding"
          value={summary.data?.outstandingInvoices.count}
          description={
            outstandingCurrencies > 0
              ? `Open receivables across ${outstandingCurrencies} currenc${outstandingCurrencies === 1 ? "y" : "ies"}`
              : "No unpaid invoice balances"
          }
          icon={Receipt}
          isLoading={summary.isLoading}
          isError={summary.isError}
        />
        <DashboardStatCard
          title="Departures · 30d"
          value={summary.data?.counts.departuresNext30Days}
          description="Confirmed trips starting soon"
          icon={PlaneTakeoff}
          isLoading={summary.isLoading}
          isError={summary.isError}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <MonthlyBookingsWidget
          points={summary.data?.monthlyBookings ?? []}
          isLoading={summary.isLoading}
          isError={summary.isError}
        />
        <BookingStatusWidget
          rows={summary.data?.bookingsByStatus ?? []}
          isLoading={summary.isLoading}
          isError={summary.isError}
        />
      </section>

      <section
        className={`grid gap-4 ${
          revenueSeries.length > 1 ? "xl:grid-cols-[1fr_1fr_0.9fr]" : "xl:grid-cols-[1.4fr_0.9fr]"
        }`}
      >
        {revenueSeries.length > 0 ? (
          revenueSeries.map((series) => (
            <RevenueWidget
              key={series.currency}
              series={series}
              isLoading={summary.isLoading}
              isError={summary.isError}
            />
          ))
        ) : (
          <RevenueWidget
            series={undefined}
            isLoading={summary.isLoading}
            isError={summary.isError}
          />
        )}
        <OutstandingInvoicesWidget
          rows={summary.data?.outstandingInvoices.byCurrency ?? []}
          isLoading={summary.isLoading}
          isError={summary.isError}
        />
      </section>
    </div>
  )
}
