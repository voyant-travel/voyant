import { createFileRoute } from "@tanstack/react-router"
import { ResourcesPage } from "@/components/voyant/resources/resources-page"
import { ResourcesPageSkeleton } from "@/components/voyant/resources/resources-page-skeleton"
import {
  getResourceAllocationsQueryOptions,
  getResourceAssignmentsQueryOptions,
  getResourceBookingsQueryOptions,
  getResourceCloseoutsQueryOptions,
  getResourcePoolsQueryOptions,
  getResourceProductsQueryOptions,
  getResourceResourcesQueryOptions,
  getResourceRulesQueryOptions,
  getResourceSlotsQueryOptions,
  getResourceStartTimesQueryOptions,
  getResourceSuppliersQueryOptions,
} from "@/components/voyant/resources/resources-shared"

// Tab dashboard — `resources` is the default active tab. Await only the
// queries that tab needs; everything else (other tabs + dimensions used
// by filter pickers) is fired as a background prefetch so the route paints
// after one round-trip instead of waiting on 11.
export const Route = createFileRoute("/_workspace/resources/")({
  ssr: "data-only",
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(getResourceResourcesQueryOptions())

    void context.queryClient.prefetchQuery(getResourceSuppliersQueryOptions())
    void context.queryClient.prefetchQuery(getResourceProductsQueryOptions())
    void context.queryClient.prefetchQuery(getResourceBookingsQueryOptions())
    void context.queryClient.prefetchQuery(getResourceSlotsQueryOptions())
    void context.queryClient.prefetchQuery(getResourceRulesQueryOptions())
    void context.queryClient.prefetchQuery(getResourceStartTimesQueryOptions())
    void context.queryClient.prefetchQuery(getResourcePoolsQueryOptions())
    void context.queryClient.prefetchQuery(getResourceAllocationsQueryOptions())
    void context.queryClient.prefetchQuery(getResourceAssignmentsQueryOptions())
    void context.queryClient.prefetchQuery(getResourceCloseoutsQueryOptions())
  },
  pendingComponent: ResourcesPageSkeleton,
  component: ResourcesPage,
})
