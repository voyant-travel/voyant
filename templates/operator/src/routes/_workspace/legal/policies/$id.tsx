import { createFileRoute } from "@tanstack/react-router"
import {
  getLegalPolicyAcceptancesQueryOptions,
  getLegalPolicyAssignmentsQueryOptions,
  getLegalPolicyQueryOptions,
  getLegalPolicyVersionsQueryOptions,
} from "@voyantjs/legal-react"
import { PolicyDetailPage } from "@voyantjs/legal-ui"

import { PolicyAssignmentDialog } from "@/components/voyant/legal/policy-assignment-dialog"
import { PolicyDialog } from "@/components/voyant/legal/policy-dialog"
import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

export const Route = createFileRoute("/_workspace/legal/policies/$id")({
  ssr: "data-only",
  loader: async ({ context, params }) => {
    const client = { baseUrl: getApiUrl(), fetcher: operatorFetcher }

    await context.queryClient.ensureQueryData(getLegalPolicyQueryOptions(client, params.id))

    void context.queryClient.prefetchQuery(
      getLegalPolicyVersionsQueryOptions(client, { policyId: params.id }),
    )
    void context.queryClient.prefetchQuery(
      getLegalPolicyAssignmentsQueryOptions(client, { policyId: params.id }),
    )
    void context.queryClient.prefetchQuery(
      getLegalPolicyAcceptancesQueryOptions(client, { limit: 50, offset: 0 }),
    )
  },
  component: PolicyDetailRoute,
})

function PolicyDetailRoute() {
  const { id } = Route.useParams()
  const navigate = Route.useNavigate()

  return (
    <PolicyDetailPage
      id={id}
      onBackToPolicies={() => void navigate({ to: "/legal/policies" })}
      renderPolicyDialog={(props) => <PolicyDialog {...props} />}
      renderPolicyAssignmentDialog={(props) => <PolicyAssignmentDialog {...props} />}
    />
  )
}
