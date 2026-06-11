import { createFileRoute } from "@tanstack/react-router"
import { getLegalContractTemplatesQueryOptions } from "@voyantjs/legal-react"
import { TemplatesHost } from "@voyantjs/legal-ui/admin"

import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

export const Route = createFileRoute("/_workspace/legal/templates/")({
  ssr: "data-only",
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      getLegalContractTemplatesQueryOptions(
        { baseUrl: getApiUrl(), fetcher: operatorFetcher },
        { search: "", scope: "all" },
      ),
    ),
  component: TemplatesHost,
})
