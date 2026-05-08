import { createFileRoute } from "@tanstack/react-router"
import { AvailabilitySlotDetailSkeleton } from "@voyantjs/availability-ui"
import {
  AvailabilitySlotDetailPage,
  loadAvailabilitySlotDetailPage,
} from "@/components/voyant/availability/availability-slot-detail-page"

export const Route = createFileRoute("/_workspace/availability/$id")({
  loader: ({ context, params }) => loadAvailabilitySlotDetailPage(context.queryClient, params.id),
  pendingComponent: AvailabilitySlotDetailSkeleton,
  component: RouteComponent,
})

function RouteComponent() {
  const { id } = Route.useParams()
  return <AvailabilitySlotDetailPage id={id} />
}
