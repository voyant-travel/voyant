import { createFileRoute } from "@tanstack/react-router"
import { getSupplierInvoicesQueryOptions } from "@voyantjs/finance-react"
import { SupplierInvoicesPage } from "@voyantjs/finance-ui"

import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

export const Route = createFileRoute("/_workspace/finance/supplier-invoices/")({
  ssr: "data-only",
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      getSupplierInvoicesQueryOptions({ baseUrl: getApiUrl(), fetcher: operatorFetcher }),
    ),
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = Route.useNavigate()

  return (
    <SupplierInvoicesPage
      onOpenSupplierInvoice={(id) =>
        void navigate({
          to: "/finance/supplier-invoices/$id",
          params: { id },
        })
      }
    />
  )
}
