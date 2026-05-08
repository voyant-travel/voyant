import { createFileRoute } from "@tanstack/react-router"
import { defaultFetcher, getAllPaymentsQueryOptions } from "@voyantjs/finance-react"

import { PaymentsPage } from "@/components/voyant/finance/payments-page"
import { PaymentsPageSkeleton } from "@/components/voyant/finance/payments-page-skeleton"
import { getApiUrl } from "@/lib/env"

export const Route = createFileRoute("/_workspace/finance/payments/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      getAllPaymentsQueryOptions({ baseUrl: getApiUrl(), fetcher: defaultFetcher }),
    ),
  pendingComponent: PaymentsPageSkeleton,
  component: PaymentsPage,
})
