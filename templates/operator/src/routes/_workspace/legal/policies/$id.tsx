import { createFileRoute } from "@tanstack/react-router"
import {
  getLegalPolicyAcceptancesQueryOptions,
  getLegalPolicyAssignmentsQueryOptions,
  getLegalPolicyQueryOptions,
  getLegalPolicyVersionsQueryOptions,
} from "@voyantjs/legal-react"
import { PolicyDetailHost } from "@voyantjs/legal-ui/admin"

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
  return <PolicyDetailHost id={id} />
}
