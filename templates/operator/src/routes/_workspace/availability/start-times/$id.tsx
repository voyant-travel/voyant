import { createFileRoute } from "@tanstack/react-router"
import { AvailabilityStartTimeDetailSkeleton } from "@voyantjs/availability-ui"
import {
  AvailabilityStartTimeDetailPage,
  loadAvailabilityStartTimeDetailPage,
} from "@/components/voyant/availability/availability-start-time-detail-page"

export const Route = createFileRoute("/_workspace/availability/start-times/$id")({
  loader: ({ context, params }) =>
    loadAvailabilityStartTimeDetailPage(context.queryClient, params.id),
  pendingComponent: AvailabilityStartTimeDetailSkeleton,
  component: RouteComponent,
})

function RouteComponent() {
  const { id } = Route.useParams()
  return <AvailabilityStartTimeDetailPage id={id} />
}
