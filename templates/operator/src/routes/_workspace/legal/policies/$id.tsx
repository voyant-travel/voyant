import { createFileRoute } from "@tanstack/react-router"
import {
  loadPolicyDetailPage,
  PolicyDetailPage,
} from "@/components/voyant/legal/policy-detail-page"

export const Route = createFileRoute("/_workspace/legal/policies/$id")({
  loader: ({ context, params }) => loadPolicyDetailPage(params.id, context.queryClient),
  component: PolicyDetailRoute,
})

function PolicyDetailRoute() {
  const { id } = Route.useParams()
  return <PolicyDetailPage id={id} />
}
