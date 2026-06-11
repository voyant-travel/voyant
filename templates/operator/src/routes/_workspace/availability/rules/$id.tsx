import { createFileRoute } from "@tanstack/react-router"
import {
  AvailabilityRuleDetailSkeleton,
  loadAvailabilityRuleDetailPage,
} from "@voyantjs/availability-ui"
import { AvailabilityRuleDetailHost } from "@voyantjs/availability-ui/admin"
import { getAvailabilityContextValue } from "@/lib/availability-context"

// Thin host for the package-delivered rule detail page (packaged-admin RFC
// Phase 3). Page and navigation (semantic destinations, RFC §4.7) are
// package-owned; this file only binds the route param. The loader stays
// app-side for the SSR prefetch (the availability context value uses the
// cookie-forwarding fetcher).
export const Route = createFileRoute("/_workspace/availability/rules/$id")({
  loader: ({ context, params }) =>
    loadAvailabilityRuleDetailPage(context.queryClient, getAvailabilityContextValue(), params.id),
  pendingComponent: AvailabilityRuleDetailSkeleton,
  component: RouteComponent,
})

function RouteComponent() {
  const { id } = Route.useParams()
  return <AvailabilityRuleDetailHost ruleId={id} />
}
