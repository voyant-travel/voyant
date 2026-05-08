import { createFileRoute } from "@tanstack/react-router"
import { defaultFetcher, getInvoicesQueryOptions } from "@voyantjs/finance-react"

import { InvoicesPage } from "@/components/voyant/finance/invoices-page"
import { InvoicesPageSkeleton } from "@/components/voyant/finance/invoices-page-skeleton"
import { getApiUrl } from "@/lib/env"

export const Route = createFileRoute("/_workspace/finance/invoices/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      getInvoicesQueryOptions({ baseUrl: getApiUrl(), fetcher: defaultFetcher }),
    ),
  pendingComponent: InvoicesPageSkeleton,
  component: InvoicesPage,
})
