import { createFileRoute } from "@tanstack/react-router"
import { getPaymentQueryOptions } from "@voyantjs/finance-react"
import { PaymentDetailHost, PaymentDetailSkeleton } from "@voyantjs/finance-react/admin"

import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

export const Route = createFileRoute("/_workspace/finance/payments/$id")({
  ssr: "data-only",
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      getPaymentQueryOptions({ baseUrl: getApiUrl(), fetcher: operatorFetcher }, params.id),
    ),
  pendingComponent: PaymentDetailSkeleton,
  component: PaymentDetailRoute,
})

function PaymentDetailRoute() {
  const { id } = Route.useParams()
  return <PaymentDetailHost id={id} />
}
