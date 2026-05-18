import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useAdminBreadcrumbs } from "@voyantjs/admin"
import {
  AvailabilityRuleDetailPage,
  AvailabilityRuleDetailSkeleton,
  getAvailabilityRuleDetailQueryOptions,
  loadAvailabilityRuleDetailPage,
} from "@voyantjs/availability-ui"
import { getAvailabilityContextValue } from "@/lib/availability-context"

export const Route = createFileRoute("/_workspace/availability/rules/$id")({
  loader: ({ context, params }) =>
    loadAvailabilityRuleDetailPage(context.queryClient, getAvailabilityContextValue(), params.id),
  pendingComponent: AvailabilityRuleDetailSkeleton,
  component: RouteComponent,
})

function RouteComponent() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const client = getAvailabilityContextValue()
  const ruleQuery = useQuery(getAvailabilityRuleDetailQueryOptions(client, id))
  const rule = ruleQuery.data?.data

  useAdminBreadcrumbs([
    { label: "Availability", href: "/availability" },
    ...(rule ? [{ label: rule.productName ?? `Rule ${rule.id.slice(-6)}` }] : []),
  ])

  return (
    <AvailabilityRuleDetailPage
      id={id}
      onBack={() => void navigate({ to: "/availability" })}
      onDeleted={() => void navigate({ to: "/availability" })}
      onOpenProduct={(productId) =>
        void navigate({ to: "/products/$id", params: { id: productId } })
      }
      onOpenSlot={(slotId) => void navigate({ to: "/availability/$id", params: { id: slotId } })}
    />
  )
}
