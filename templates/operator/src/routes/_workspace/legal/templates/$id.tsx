import { createFileRoute } from "@tanstack/react-router"
import {
  getLegalContractTemplateQueryOptions,
  getLegalContractTemplateVersionsQueryOptions,
} from "@voyantjs/legal-react"
import { TemplateDetailHost } from "@voyantjs/legal-ui/admin"

import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

export const Route = createFileRoute("/_workspace/legal/templates/$id")({
  ssr: "data-only",
  loader: async ({ context, params }) => {
    const client = { baseUrl: getApiUrl(), fetcher: operatorFetcher }

    await context.queryClient.ensureQueryData(
      getLegalContractTemplateQueryOptions(client, params.id),
    )

    void context.queryClient.prefetchQuery(
      getLegalContractTemplateVersionsQueryOptions(client, { templateId: params.id }),
    )
  },
  component: TemplateDetailRoute,
})

function TemplateDetailRoute() {
  const { id } = Route.useParams()
  return <TemplateDetailHost id={id} />
}
