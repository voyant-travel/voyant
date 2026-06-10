import { createFileRoute } from "@tanstack/react-router"
import { DashboardSkeleton } from "@voyantjs/admin/dashboard/skeleton"
import { lazy, Suspense } from "react"

import {
  getOperatorDashboardBookingsAggregatesQueryOptions,
  getOperatorDashboardFinanceAggregatesQueryOptions,
  getOperatorDashboardProductsAggregatesQueryOptions,
  getOperatorDashboardSuppliersAggregatesQueryOptions,
} from "@/lib/dashboard-ssr-query-options"

// DashboardPage pulls recharts. The generated route tree statically imports
// this route module, so keep the chart page behind dynamic import().
const DashboardPage = lazy(() =>
  import("@voyantjs/admin/dashboard").then((module) => ({ default: module.DashboardPage })),
)

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
  component: DashboardRoute,
})

function DashboardRoute() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardPage />
    </Suspense>
  )
}
