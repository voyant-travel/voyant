import { createFileRoute } from "@tanstack/react-router"
import { getLegalPoliciesQueryOptions } from "@voyantjs/legal-react"
import { PoliciesHost } from "@voyantjs/legal-react/admin"

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
  component: PoliciesHost,
})
