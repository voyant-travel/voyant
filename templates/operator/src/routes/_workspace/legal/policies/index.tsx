import { createFileRoute } from "@tanstack/react-router"
import { getLegalPoliciesQueryOptions } from "@voyantjs/legal-react"
import { PoliciesPage } from "@voyantjs/legal-ui"

import { PolicyDialog } from "@/components/voyant/legal/policy-dialog"
import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

export const Route = createFileRoute("/_workspace/legal/policies/")({
  ssr: "data-only",
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      getLegalPoliciesQueryOptions(
        { baseUrl: getApiUrl(), fetcher: operatorFetcher },
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
