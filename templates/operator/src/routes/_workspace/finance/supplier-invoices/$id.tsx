import { createFileRoute } from "@tanstack/react-router"
import { getSupplierInvoiceQueryOptions } from "@voyantjs/finance-react"
import { SupplierInvoiceDetailPage } from "@voyantjs/finance-ui"

import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

export const Route = createFileRoute("/_workspace/finance/supplier-invoices/$id")({
  ssr: "data-only",
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      getSupplierInvoiceQueryOptions({ baseUrl: getApiUrl(), fetcher: operatorFetcher }, params.id),
    ),
  component: SupplierInvoiceDetailRoute,
})

function SupplierInvoiceDetailRoute() {
  const { id } = Route.useParams()
  const navigate = Route.useNavigate()

  return (
    <SupplierInvoiceDetailPage
      id={id}
      onBack={() => void navigate({ to: "/finance/supplier-invoices" })}
      onDownloadDocument={() => {
        window.open(
          `${getApiUrl()}/v1/admin/finance/supplier-invoices/${id}/document/download`,
          "_blank",
          "noopener,noreferrer",
        )
      }}
    />
  )
}
