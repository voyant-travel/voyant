import { createFileRoute } from "@tanstack/react-router"
import { getInvoicesQueryOptions } from "@voyantjs/finance-react"
import { InvoicesPage, InvoicesPageSkeleton } from "@voyantjs/finance-react/ui"

import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

export const Route = createFileRoute("/_workspace/finance/invoices/")({
  ssr: "data-only",
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      getInvoicesQueryOptions({ baseUrl: getApiUrl(), fetcher: operatorFetcher }),
    ),
  pendingComponent: InvoicesPageSkeleton,
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = Route.useNavigate()

  return (
    <InvoicesPage
      onOpenInvoice={(id) =>
        void navigate({
          to: "/finance/invoices/$id",
          params: { id },
        })
      }
    />
  )
}
