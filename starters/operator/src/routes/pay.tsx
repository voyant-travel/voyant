import { createFileRoute, Navigate } from "@tanstack/react-router"
import { PaymentLinkResolverPage } from "@voyant-travel/finance-react/storefront"
import { useStorefrontMessages } from "@voyant-travel/storefront-react/storefront"
import { z } from "zod"

import { OperatorStorefrontMessagesProvider } from "@/lib/storefront-messages"

const searchSchema = z.object({
  orderID: z.string().optional(),
  orderId: z.string().optional(),
  sessionId: z.string().optional(),
})

export const Route = createFileRoute("/pay")({
  validateSearch: searchSchema,
  component: PayRoute,
})

function PayRoute() {
  return (
    <OperatorStorefrontMessagesProvider>
      <PayRouteAdapter />
    </OperatorStorefrontMessagesProvider>
  )
}

function PayRouteAdapter() {
  const { orderID, orderId, sessionId } = Route.useSearch()
  const messages = useStorefrontMessages().pay
  return (
    <PaymentLinkResolverPage
      reference={orderID ?? orderId ?? sessionId ?? null}
      messages={messages}
      renderResolvedSession={(resolvedSessionId) => (
        <Navigate to="/pay/$sessionId" params={{ sessionId: resolvedSessionId }} replace />
      )}
    />
  )
}
