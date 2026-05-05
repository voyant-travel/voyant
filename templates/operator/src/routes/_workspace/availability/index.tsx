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

export const Route = createFileRoute("/_workspace/availability/")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(getAvailabilityProductsQueryOptions()),
      context.queryClient.ensureQueryData(getAvailabilityRulesQueryOptions()),
      context.queryClient.ensureQueryData(getAvailabilityStartTimesQueryOptions()),
      context.queryClient.ensureQueryData(getAvailabilitySlotsQueryOptions()),
      context.queryClient.ensureQueryData(getAvailabilityCloseoutsQueryOptions()),
      context.queryClient.ensureQueryData(getAvailabilityPickupPointsQueryOptions()),
    ]),
  pendingComponent: AvailabilityPageSkeleton,
  component: AvailabilityPage,
})
