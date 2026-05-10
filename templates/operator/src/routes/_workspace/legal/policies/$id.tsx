import { createFileRoute } from "@tanstack/react-router"
import {
  defaultFetcher,
  getLegalPolicyAcceptancesQueryOptions,
  getLegalPolicyAssignmentsQueryOptions,
  getLegalPolicyQueryOptions,
  getLegalPolicyVersionsQueryOptions,
} from "@voyantjs/legal-react"
import { PolicyDetailPage } from "@voyantjs/legal-ui"

import { PolicyAssignmentDialog } from "@/components/voyant/legal/policy-assignment-dialog"
import { PolicyDialog } from "@/components/voyant/legal/policy-dialog"
import { getApiUrl } from "@/lib/env"

export const Route = createFileRoute("/_workspace/legal/policies/$id")({
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(
        getLegalPolicyQueryOptions({ baseUrl: getApiUrl(), fetcher: defaultFetcher }, params.id),
      ),
      context.queryClient.ensureQueryData(
        getLegalPolicyVersionsQueryOptions(
          { baseUrl: getApiUrl(), fetcher: defaultFetcher },
          { policyId: params.id },
        ),
      ),
      context.queryClient.ensureQueryData(
        getLegalPolicyAssignmentsQueryOptions(
          { baseUrl: getApiUrl(), fetcher: defaultFetcher },
          { policyId: params.id },
        ),
      ),
      context.queryClient.ensureQueryData(
        getLegalPolicyAcceptancesQueryOptions(
          { baseUrl: getApiUrl(), fetcher: defaultFetcher },
          { limit: 50, offset: 0 },
        ),
      ),
    ]),
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
