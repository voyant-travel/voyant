import { createFileRoute, Navigate } from "@tanstack/react-router"
import { PublicPaymentLinkPage } from "@voyant-travel/finance-react/storefront"

import { useAdminMessages } from "@/lib/admin-i18n"
import { StorefrontMessagesProvider, useStorefrontMessages } from "@/lib/storefront-i18n"

export const Route = createFileRoute("/pay_/$sessionId")({
  component: PaymentLinkRoute,
})

function PaymentLinkRoute() {
  return (
    <StorefrontMessagesProvider>
      <PaymentLinkRouteAdapter />
    </StorefrontMessagesProvider>
  )
}

function PaymentLinkRouteAdapter() {
  const { sessionId } = Route.useParams()
  const adminMessages = useAdminMessages()
  const messages = useStorefrontMessages().pay
  return (
    <PublicPaymentLinkPage
      sessionId={sessionId}
      messages={{
        ...messages,
        bookingSummary: adminMessages.bookings.detail.paymentLinkSummary,
        tripSummary: adminMessages.trips.paymentLinkSummary,
      }}
      renderResolvedSession={(resolvedSessionId) => (
        <Navigate to="/pay/$sessionId" params={{ sessionId: resolvedSessionId }} replace />
      )}
    />
  )
}
