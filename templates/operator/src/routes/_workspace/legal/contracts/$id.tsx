import { createFileRoute } from "@tanstack/react-router"
import {
  getLegalContractAttachmentsQueryOptions,
  getLegalContractQueryOptions,
  getLegalContractSignaturesQueryOptions,
} from "@voyantjs/legal-react"
import { ContractDetailHost } from "@voyantjs/legal-ui/admin"

import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

export const Route = createFileRoute("/_workspace/legal/contracts/$id")({
  ssr: "data-only",
  loader: async ({ context, params }) => {
    const client = { baseUrl: getApiUrl(), fetcher: operatorFetcher }

    await context.queryClient.ensureQueryData(getLegalContractQueryOptions(client, params.id))

    void context.queryClient.prefetchQuery(
      getLegalContractSignaturesQueryOptions(client, { contractId: params.id }),
    )
    void context.queryClient.prefetchQuery(
      getLegalContractAttachmentsQueryOptions(client, { contractId: params.id }),
    )
  },
  component: ContractDetailRoute,
})

function ContractDetailRoute() {
  const { id } = Route.useParams()
  return <ContractDetailHost id={id} />
}
