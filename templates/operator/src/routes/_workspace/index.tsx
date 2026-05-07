import { createFileRoute } from "@tanstack/react-router"
import { DashboardPage } from "@/components/voyant/dashboard/dashboard-page"
import {
  getDashboardBookingsAggregatesQueryOptions,
  getDashboardFinanceAggregatesQueryOptions,
  getDashboardProductsAggregatesQueryOptions,
  getDashboardSuppliersAggregatesQueryOptions,
} from "@/components/voyant/dashboard/dashboard-shared"
import { DashboardSkeleton } from "@/components/voyant/dashboard/dashboard-skeleton"

export const Route = createFileRoute("/_workspace/")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(getDashboardBookingsAggregatesQueryOptions()),
      context.queryClient.ensureQueryData(getDashboardProductsAggregatesQueryOptions()),
      context.queryClient.ensureQueryData(getDashboardSuppliersAggregatesQueryOptions()),
      context.queryClient.ensureQueryData(getDashboardFinanceAggregatesQueryOptions()),
    ]),
  pendingComponent: DashboardSkeleton,
  component: DashboardPage,
})
