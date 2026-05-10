import { createFileRoute } from "@tanstack/react-router"
import { usePerson } from "@voyantjs/crm-react"
import { defaultFetcher, getLegalContractsQueryOptions } from "@voyantjs/legal-react"
import { ContractsPage } from "@voyantjs/legal-ui"

import { ContractDialog } from "@/components/voyant/legal/contract-dialog"
import { getApiUrl } from "@/lib/env"

export const Route = createFileRoute("/_workspace/legal/contracts/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      getLegalContractsQueryOptions(
        { baseUrl: getApiUrl(), fetcher: defaultFetcher },
        {
          search: "",
          scope: "all",
          status: "all",
          limit: 25,
          offset: 0,
        },
      ),
    ),
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = Route.useNavigate()

  return (
    <ContractsPage
      onOpenContract={(id) =>
        void navigate({
          to: "/legal/contracts/$id",
          params: { id },
        })
      }
      renderContractDialog={(props) => <ContractDialog {...props} />}
      renderPersonCell={(personId) => <PersonNameCell personId={personId} />}
    />
  )
}

function PersonNameCell({ personId }: { personId: string | null }): React.ReactElement {
  const { data, isLoading } = usePerson(personId ?? undefined, {
    enabled: Boolean(personId),
  })
  if (!personId) return <span className="text-muted-foreground">-</span>
  if (isLoading) return <span className="text-muted-foreground text-xs">...</span>
  if (!data) {
    return (
      <span className="font-mono text-xs text-muted-foreground" title={personId}>
        {personId.slice(0, 16)}...
      </span>
    )
  }
  const name = `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim()
  return <span className="text-sm">{name || personId.slice(0, 16)}</span>
}
