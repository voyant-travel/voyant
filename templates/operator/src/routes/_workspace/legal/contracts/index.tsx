import { createFileRoute } from "@tanstack/react-router"
import { getLegalContractsQueryOptions } from "@voyantjs/legal-react"
import { ContractsHost } from "@voyantjs/legal-ui/admin"

import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

export const Route = createFileRoute("/_workspace/legal/contracts/")({
  ssr: "data-only",
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      getLegalContractsQueryOptions(
        { baseUrl: getApiUrl(), fetcher: operatorFetcher },
        {
          search: "",
          scope: "all",
          status: "all",
          limit: 25,
          offset: 0,
        },
      ),
    ),
  component: ContractsHost,
})
