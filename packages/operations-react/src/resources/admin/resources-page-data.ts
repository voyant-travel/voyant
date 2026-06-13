import type { QueryClient } from "@tanstack/react-query"
import type { ResourcesPageQueryFilters } from "../components/resources-page.js"
import {
  getAllocationsQueryOptions,
  getAssignmentsQueryOptions,
  getBookingsQueryOptions,
  getCloseoutsQueryOptions,
  getPoolsQueryOptions,
  getProductsQueryOptions,
  getResourcesQueryOptions,
  getRulesQueryOptions,
  getSlotsQueryOptions,
  getStartTimesQueryOptions,
  getSuppliersQueryOptions,
  type VoyantResourcesContextValue,
} from "../index.js"

/**
 * Canonical list filters for the resources tab dashboard. Shared between
 * the SSR route loader ({@link ensureResourcesPageData}) and the packaged
 * page's hooks (via `ResourcesPage`'s `queryFilters` prop) so both sides
 * produce identical query keys and the loader-seeded cache is reused.
 */
export const resourcesPageQueryFilters = {
  suppliers: { limit: 25, offset: 0 },
  products: { limit: 100 },
  bookings: { limit: 25, offset: 0 },
  slots: { limit: 25, offset: 0 },
  rules: { limit: 25, offset: 0 },
  startTimes: { limit: 25, offset: 0 },
  resources: { limit: 25, offset: 0 },
  pools: { limit: 25, offset: 0 },
  allocations: { limit: 25, offset: 0 },
  assignments: { limit: 25, offset: 0 },
  closeouts: { limit: 25, offset: 0 },
} as const satisfies ResourcesPageQueryFilters

/**
 * Tab dashboard loader: `resources` is the default active tab, so only that
 * query is awaited; everything else (other tabs + dimensions used by the
 * filter pickers) is fired as a background prefetch so the route paints
 * after one round-trip instead of waiting on 11.
 */
export async function ensureResourcesPageData(
  queryClient: QueryClient,
  client: VoyantResourcesContextValue,
): Promise<void> {
  await queryClient.ensureQueryData(
    getResourcesQueryOptions(client, resourcesPageQueryFilters.resources),
  )

  void queryClient.prefetchQuery(
    getSuppliersQueryOptions(client, resourcesPageQueryFilters.suppliers),
  )
  void queryClient.prefetchQuery(
    getProductsQueryOptions(client, resourcesPageQueryFilters.products),
  )
  void queryClient.prefetchQuery(
    getBookingsQueryOptions(client, resourcesPageQueryFilters.bookings),
  )
  void queryClient.prefetchQuery(getSlotsQueryOptions(client, resourcesPageQueryFilters.slots))
  void queryClient.prefetchQuery(getRulesQueryOptions(client, resourcesPageQueryFilters.rules))
  void queryClient.prefetchQuery(
    getStartTimesQueryOptions(client, resourcesPageQueryFilters.startTimes),
  )
  void queryClient.prefetchQuery(getPoolsQueryOptions(client, resourcesPageQueryFilters.pools))
  void queryClient.prefetchQuery(
    getAllocationsQueryOptions(client, resourcesPageQueryFilters.allocations),
  )
  void queryClient.prefetchQuery(
    getAssignmentsQueryOptions(client, resourcesPageQueryFilters.assignments),
  )
  void queryClient.prefetchQuery(
    getCloseoutsQueryOptions(client, resourcesPageQueryFilters.closeouts),
  )
}
