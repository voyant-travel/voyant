import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { AvailabilityPage } from "@/components/voyant/availability/availability-page"
import {
  type AvailabilityPageTabId,
  getAvailabilityCloseoutsQueryOptions,
  getAvailabilityPickupPointsQueryOptions,
  getAvailabilityProductsQueryOptions,
  getAvailabilityRulesQueryOptions,
  getAvailabilitySlotsQueryOptions,
  getAvailabilityStartTimesQueryOptions,
  isAvailabilityPageTabId,
} from "@/components/voyant/availability/availability-shared"

interface AvailabilitySearch {
  productId?: string
  tab?: AvailabilityPageTabId
}

export const Route = createFileRoute("/_workspace/availability/")({
  validateSearch: (search): AvailabilitySearch => {
    const productId = typeof search.productId === "string" ? search.productId : undefined
    const tab = isAvailabilityPageTabId(search.tab) ? search.tab : undefined
    return { productId, tab }
  },
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(getAvailabilityProductsQueryOptions()),
      context.queryClient.ensureQueryData(getAvailabilityRulesQueryOptions()),
      context.queryClient.ensureQueryData(getAvailabilityStartTimesQueryOptions()),
      context.queryClient.ensureQueryData(getAvailabilitySlotsQueryOptions()),
      context.queryClient.ensureQueryData(getAvailabilityCloseoutsQueryOptions()),
      context.queryClient.ensureQueryData(getAvailabilityPickupPointsQueryOptions()),
    ]),
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate({ from: Route.fullPath })
  const { productId, tab } = Route.useSearch()

  return (
    <AvailabilityPage
      initialProductId={productId ?? null}
      initialTab={tab}
      onProductFilterChange={(nextProductId) => {
        void navigate({
          search: (prev) => ({ ...prev, productId: nextProductId ?? undefined }),
          replace: true,
        })
      }}
      onTabChange={(nextTab) => {
        void navigate({
          // Default tab stays out of the URL so a bare `/availability`
          // doesn't get rewritten to `/availability?tab=slots`.
          search: (prev) => ({ ...prev, tab: nextTab === "slots" ? undefined : nextTab }),
          replace: true,
        })
      }}
    />
  )
}
