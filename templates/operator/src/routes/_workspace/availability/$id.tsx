import { createFileRoute } from "@tanstack/react-router"
import { AvailabilitySlotDetailHost } from "@voyantjs/availability-react/admin"
import {
  AvailabilitySlotDetailSkeleton,
  loadAvailabilitySlotDetailPage,
} from "@voyantjs/availability-react/ui"
import { getAvailabilityContextValue } from "@/lib/availability-context"

// Thin host for the package-delivered slot detail page (packaged-admin RFC
// Phase 3). Page, cross-domain sheets and navigation (semantic destinations,
// RFC §4.7) are package-owned; this file only binds the route param. The
// loader stays app-side for the SSR prefetch (the availability context value
// uses the cookie-forwarding fetcher).
export const Route = createFileRoute("/_workspace/availability/$id")({
  loader: ({ context, params }) =>
    loadAvailabilitySlotDetailPage(context.queryClient, getAvailabilityContextValue(), params.id),
  pendingComponent: AvailabilitySlotDetailSkeleton,
  component: RouteComponent,
})

function RouteComponent() {
  const { id } = Route.useParams()
  return <AvailabilitySlotDetailHost slotId={id} />
}
