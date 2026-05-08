import { createFileRoute } from "@tanstack/react-router"
import { defaultFetcher, getPaymentQueryOptions } from "@voyantjs/finance-react"

import { PaymentDetailPage } from "@/components/voyant/finance/payment-detail-page"
import { PaymentDetailSkeleton } from "@/components/voyant/finance/payment-detail-skeleton"
import { getApiUrl } from "@/lib/env"

export const Route = createFileRoute("/_workspace/finance/payments/$id")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      getPaymentQueryOptions({ baseUrl: getApiUrl(), fetcher: defaultFetcher }, params.id),
    ),
  pendingComponent: PaymentDetailSkeleton,
  component: PaymentDetailRoute,
})

function PaymentDetailRoute() {
  const { id } = Route.useParams()
  return <PaymentDetailPage id={id} />
}
