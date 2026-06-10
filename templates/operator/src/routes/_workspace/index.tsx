import { createFileRoute } from "@tanstack/react-router"
// DashboardPage pulls recharts (~390 KB). Subpath import so only the
// dashboard route's chunk references it — no leakage into the workspace
// shell that's loaded by every other route.
import { DashboardPage } from "@voyantjs/admin/dashboard"

import {
  getOperatorDashboardBookingsAggregatesQueryOptions,
  getOperatorDashboardFinanceAggregatesQueryOptions,
  getOperatorDashboardProductsAggregatesQueryOptions,
  getOperatorDashboardSuppliersAggregatesQueryOptions,
} from "@/lib/dashboard-ssr-query-options"

export const Route = createFileRoute("/_workspace/")({
  ssr: "data-only",
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(getOperatorDashboardBookingsAggregatesQueryOptions()),
      context.queryClient.ensureQueryData(getOperatorDashboardProductsAggregatesQueryOptions()),
      context.queryClient.ensureQueryData(getOperatorDashboardSuppliersAggregatesQueryOptions()),
      context.queryClient.ensureQueryData(getOperatorDashboardFinanceAggregatesQueryOptions()),
    ])
  },
  component: DashboardPage,
})
