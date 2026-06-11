import type { QueryClient } from "@tanstack/react-query"
import {
  getProductsQueryOptions,
  getRulesQueryOptions,
  getSlotsQueryOptions,
  getStartTimesQueryOptions,
  type VoyantAvailabilityContextValue,
} from "@voyantjs/availability-react"

/**
 * Canonical first-page list filters for the availability index page.
 * `AvailabilityPage` hard-codes the same filters in its hooks, so the
 * loader-seeded cache entries line up with the page's query keys.
 */
const availabilityPageQueryFilters = {
  products: { limit: 25, offset: 0 },
  slots: { limit: 25, offset: 0 },
  rules: { limit: 25, offset: 0 },
  startTimes: { limit: 25, offset: 0 },
} as const

/**
 * Index page loader: await only what the slots tab + the products picker
 * (top of page) need for first paint; the rules/start-times dimensions that
 * back the slot create/edit dialog prefetch in the background.
 */
export async function ensureAvailabilityPageData(
  queryClient: QueryClient,
  client: VoyantAvailabilityContextValue,
): Promise<void> {
  await Promise.all([
    queryClient.ensureQueryData(getSlotsQueryOptions(client, availabilityPageQueryFilters.slots)),
    queryClient.ensureQueryData(
      getProductsQueryOptions(client, availabilityPageQueryFilters.products),
    ),
  ])

  void queryClient.prefetchQuery(getRulesQueryOptions(client, availabilityPageQueryFilters.rules))
  void queryClient.prefetchQuery(
    getStartTimesQueryOptions(client, availabilityPageQueryFilters.startTimes),
  )
}
