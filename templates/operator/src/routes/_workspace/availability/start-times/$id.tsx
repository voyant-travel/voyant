import { createFileRoute } from "@tanstack/react-router"
import {
  AvailabilityStartTimeDetailSkeleton,
  loadAvailabilityStartTimeDetailPage,
} from "@voyantjs/availability-ui"
import { AvailabilityStartTimeDetailHost } from "@voyantjs/availability-ui/admin"
import { getAvailabilityContextValue } from "@/lib/availability-context"

// Thin host for the package-delivered start time detail page (packaged-admin
// RFC Phase 3). Page and navigation (semantic destinations, RFC §4.7) are
// package-owned; this file only binds the route param. The loader stays
// app-side for the SSR prefetch (the availability context value uses the
// cookie-forwarding fetcher).
export const Route = createFileRoute("/_workspace/availability/start-times/$id")({
  loader: ({ context, params }) =>
    loadAvailabilityStartTimeDetailPage(
      context.queryClient,
      getAvailabilityContextValue(),
      params.id,
    ),
  pendingComponent: AvailabilityStartTimeDetailSkeleton,
  component: RouteComponent,
})

function RouteComponent() {
  const { id } = Route.useParams()
  return <AvailabilityStartTimeDetailHost startTimeId={id} />
}
