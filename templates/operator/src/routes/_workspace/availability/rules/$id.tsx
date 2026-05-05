import { createFileRoute } from "@tanstack/react-router"
import { AvailabilityRuleDetailSkeleton } from "@voyantjs/availability-ui"
import {
  AvailabilityRuleDetailPage,
  loadAvailabilityRuleDetailPage,
} from "@/components/voyant/availability/availability-rule-detail-page"

export const Route = createFileRoute("/_workspace/availability/rules/$id")({
  loader: ({ context, params }) =>
    loadAvailabilityRuleDetailPage(context.queryClient.ensureQueryData, params.id),
  pendingComponent: AvailabilityRuleDetailSkeleton,
  component: RouteComponent,
})

function RouteComponent() {
  const { id } = Route.useParams()
  return <AvailabilityRuleDetailPage id={id} />
}
