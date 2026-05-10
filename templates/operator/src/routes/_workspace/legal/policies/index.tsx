import { createFileRoute } from "@tanstack/react-router"
import { defaultFetcher, getLegalPoliciesQueryOptions } from "@voyantjs/legal-react"
import { PoliciesPage } from "@voyantjs/legal-ui"

import { PolicyDialog } from "@/components/voyant/legal/policy-dialog"
import { getApiUrl } from "@/lib/env"

export const Route = createFileRoute("/_workspace/legal/policies/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      getLegalPoliciesQueryOptions(
        { baseUrl: getApiUrl(), fetcher: defaultFetcher },
        { search: "", kind: "all", limit: 25, offset: 0 },
      ),
    ),
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = Route.useNavigate()

  return (
    <PoliciesPage
      onOpenPolicy={(id) =>
        void navigate({
          to: "/legal/policies/$id",
          params: { id },
        })
      }
      renderPolicyDialog={(props) => <PolicyDialog {...props} />}
    />
  )
}
