import { createFileRoute } from "@tanstack/react-router"
import {
  getInvoiceCreditNotesQueryOptions,
  getInvoiceLineItemsQueryOptions,
  getInvoiceNotesQueryOptions,
  getInvoicePaymentsQueryOptions,
  getInvoiceQueryOptions,
} from "@voyantjs/finance-react"
import { InvoiceDetailHost, InvoiceDetailSkeleton } from "@voyantjs/finance-react/admin"

import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

export const Route = createFileRoute("/_workspace/finance/invoices/$id")({
  ssr: "data-only",
  loader: async ({ context, params }) => {
    const client = { baseUrl: getApiUrl(), fetcher: operatorFetcher }

    await context.queryClient.ensureQueryData(getInvoiceQueryOptions(client, params.id))

    void context.queryClient.prefetchQuery(getInvoiceLineItemsQueryOptions(client, params.id))
    void context.queryClient.prefetchQuery(getInvoicePaymentsQueryOptions(client, params.id))
    void context.queryClient.prefetchQuery(getInvoiceCreditNotesQueryOptions(client, params.id))
    void context.queryClient.prefetchQuery(getInvoiceNotesQueryOptions(client, params.id))
  },
  pendingComponent: InvoiceDetailSkeleton,
  component: InvoiceDetailRoute,
})

function InvoiceDetailRoute() {
  const { id } = Route.useParams()
  return <InvoiceDetailHost id={id} />
}
