import { createFileRoute } from "@tanstack/react-router"
import {
  defaultFetcher,
  getLegalContractAttachmentsQueryOptions,
  getLegalContractQueryOptions,
  getLegalContractSignaturesQueryOptions,
} from "@voyantjs/legal-react"
import { ContractDetailPage } from "@voyantjs/legal-ui"

import { ContractDialog } from "@/components/voyant/legal/contract-dialog"
import { getApiUrl } from "@/lib/env"

export const Route = createFileRoute("/_workspace/legal/contracts/$id")({
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(
        getLegalContractQueryOptions({ baseUrl: getApiUrl(), fetcher: defaultFetcher }, params.id),
      ),
      context.queryClient.ensureQueryData(
        getLegalContractSignaturesQueryOptions(
          { baseUrl: getApiUrl(), fetcher: defaultFetcher },
          { contractId: params.id },
        ),
      ),
      context.queryClient.ensureQueryData(
        getLegalContractAttachmentsQueryOptions(
          { baseUrl: getApiUrl(), fetcher: defaultFetcher },
          { contractId: params.id },
        ),
      ),
    ]),
  component: RouteComponent,
})

function RouteComponent() {
  const { id } = Route.useParams()
  const navigate = Route.useNavigate()

  return (
    <ContractDetailPage
      id={id}
      onBackToContracts={() => void navigate({ to: "/legal/contracts" })}
      renderContractDialog={(props) => <ContractDialog {...props} />}
      getAttachmentDownloadHref={(attachment) =>
        `/api/v1/admin/legal/contracts/attachments/${attachment.id}/download`
      }
    />
  )
}
