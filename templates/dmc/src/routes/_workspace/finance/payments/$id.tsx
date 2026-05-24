import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { defaultFetcher, getPaymentQueryOptions } from "@voyantjs/finance-react"
import { PaymentDetailPage } from "@voyantjs/finance-ui/components/payment-detail-page"

import { getApiUrl } from "@/lib/env"

export const Route = createFileRoute("/_workspace/finance/payments/$id")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      getPaymentQueryOptions({ baseUrl: getApiUrl(), fetcher: defaultFetcher }, params.id),
    ),
  component: PaymentDetailRoute,
})

function PaymentDetailRoute() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  return (
    <PaymentDetailPage
      id={id}
      onBack={() => navigate({ to: ".." })}
      onInvoiceOpen={(invoiceId) =>
        navigate({ to: "/finance/invoices/$id", params: { id: invoiceId } })
      }
      onBookingOpen={(bookingId) => navigate({ to: "/bookings/$id", params: { id: bookingId } })}
    />
  )
}
