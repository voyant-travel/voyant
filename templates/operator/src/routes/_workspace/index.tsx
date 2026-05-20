import { createFileRoute } from "@tanstack/react-router"
import {
  DashboardSkeleton,
  getDashboardBookingsAggregatesQueryOptions,
  getDashboardFinanceAggregatesQueryOptions,
  getDashboardProductsAggregatesQueryOptions,
  getDashboardSuppliersAggregatesQueryOptions,
} from "@voyantjs/admin"
// DashboardPage pulls recharts (~390 KB). Subpath import so only the
// dashboard route's chunk references it — no leakage into the workspace
// shell that's loaded by every other route.
import { DashboardPage } from "@voyantjs/admin/dashboard"
import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

const dashboardClient = { baseUrl: getApiUrl(), fetcher: operatorFetcher }

export const Route = createFileRoute("/_workspace/")({
  ssr: "data-only",
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
