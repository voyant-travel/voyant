import { createFileRoute } from "@tanstack/react-router"
import { defaultFetcher, getInvoicesQueryOptions } from "@voyantjs/finance-react"
import { InvoicesPage, InvoicesPageSkeleton } from "@voyantjs/finance-ui"

import { getApiUrl } from "@/lib/env"

export const Route = createFileRoute("/_workspace/finance/invoices/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      getInvoicesQueryOptions({ baseUrl: getApiUrl(), fetcher: defaultFetcher }),
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
