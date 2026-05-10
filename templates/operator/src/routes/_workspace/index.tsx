import { createFileRoute } from "@tanstack/react-router"
import {
  DashboardPage,
  DashboardSkeleton,
  getDashboardBookingsAggregatesQueryOptions,
  getDashboardFinanceAggregatesQueryOptions,
  getDashboardProductsAggregatesQueryOptions,
  getDashboardSuppliersAggregatesQueryOptions,
} from "@voyantjs/admin"
import { defaultFetcher } from "@voyantjs/react"
import { getApiUrl } from "@/lib/env"

const dashboardClient = { baseUrl: getApiUrl(), fetcher: defaultFetcher }

export const Route = createFileRoute("/_workspace/")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(
        getDashboardBookingsAggregatesQueryOptions(dashboardClient),
      ),
      context.queryClient.ensureQueryData(
        getDashboardProductsAggregatesQueryOptions(dashboardClient),
      ),
      context.queryClient.ensureQueryData(
        getDashboardSuppliersAggregatesQueryOptions(dashboardClient),
      ),
      context.queryClient.ensureQueryData(
        getDashboardFinanceAggregatesQueryOptions(dashboardClient),
      ),
    ]),
  pendingComponent: DashboardSkeleton,
  component: DashboardPage,
})
