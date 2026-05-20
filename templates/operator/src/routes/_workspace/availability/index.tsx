import { createFileRoute } from "@tanstack/react-router"
import { AvailabilityPageSkeleton } from "@voyantjs/availability-ui"
import { AvailabilityPage } from "@/components/voyant/availability/availability-page"
import {
  getAvailabilityCloseoutsQueryOptions,
  getAvailabilityPickupPointsQueryOptions,
  getAvailabilityProductsQueryOptions,
  getAvailabilityRulesQueryOptions,
  getAvailabilitySlotsQueryOptions,
  getAvailabilityStartTimesQueryOptions,
} from "@/components/voyant/availability/availability-shared"

// Tab dashboard — `slots` is the default. Await only what slots tab + the
// products picker (top of page) need; everything else prefetches in the
// background.
export const Route = createFileRoute("/_workspace/availability/")({
  ssr: "data-only",
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(getAvailabilitySlotsQueryOptions()),
      context.queryClient.ensureQueryData(getAvailabilityProductsQueryOptions()),
    ])

    void context.queryClient.prefetchQuery(getAvailabilityRulesQueryOptions())
    void context.queryClient.prefetchQuery(getAvailabilityStartTimesQueryOptions())
    void context.queryClient.prefetchQuery(getAvailabilityCloseoutsQueryOptions())
    void context.queryClient.prefetchQuery(getAvailabilityPickupPointsQueryOptions())
  },
  pendingComponent: AvailabilityPageSkeleton,
  component: AvailabilityPage,
})
