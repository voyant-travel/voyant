import { createFileRoute } from "@tanstack/react-router"
import { getInvoiceNumberSeriesQueryOptions } from "@voyantjs/finance-react"
import { InvoiceNumberSeriesPage } from "@voyantjs/finance-react/ui"

import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

export const Route = createFileRoute("/_workspace/finance/invoice-number-series/")({
  ssr: "data-only",
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      getInvoiceNumberSeriesQueryOptions(
        { baseUrl: getApiUrl(), fetcher: operatorFetcher },
        { limit: 100, offset: 0 },
      ),
    ),
  component: InvoiceNumberSeriesPage,
})
