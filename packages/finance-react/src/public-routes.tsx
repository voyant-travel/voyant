"use client"

import { Navigate, useParams, useSearch } from "@tanstack/react-router"
import type { ComponentType, ReactNode } from "react"
import { z } from "zod"
import { AccountantPortal } from "./components/accountant-portal.js"
import {
  type PaymentLinkResolverMessages,
  PaymentLinkResolverPage,
} from "./storefront/payment-link-resolver-page.js"
import {
  PublicPaymentLinkPage,
  type PublicPaymentLinkPageMessages,
} from "./storefront/public-payment-link-page.js"

const paymentSearchSchema = z.object({
  orderID: z.string().optional(),
  orderId: z.string().optional(),
  sessionId: z.string().optional(),
})

export interface FinancePublicRouteRuntime {
  getApiUrl(): string
  StorefrontMessagesProvider: ComponentType<{ children: ReactNode }>
  usePaymentResolverMessages(): PaymentLinkResolverMessages
  usePaymentLinkMessages(): PublicPaymentLinkPageMessages
}

export function createFinancePublicRouteContribution(runtime: FinancePublicRouteRuntime) {
  function PayRoute() {
    return (
      <runtime.StorefrontMessagesProvider>
        <PayRouteContent />
      </runtime.StorefrontMessagesProvider>
    )
  }

  function PayRouteContent() {
    const { orderID, orderId, sessionId } = useSearch({ strict: false }) as z.infer<
      typeof paymentSearchSchema
    >
    return (
      <PaymentLinkResolverPage
        reference={orderID ?? orderId ?? sessionId ?? null}
        messages={runtime.usePaymentResolverMessages()}
        renderResolvedSession={(resolvedSessionId) => (
          <Navigate to="/pay/$sessionId" params={{ sessionId: resolvedSessionId }} replace />
        )}
      />
    )
  }

  function PaymentLinkRoute() {
    return (
      <runtime.StorefrontMessagesProvider>
        <PaymentLinkRouteContent />
      </runtime.StorefrontMessagesProvider>
    )
  }

  function PaymentLinkRouteContent() {
    const { sessionId } = useParams({ strict: false }) as { sessionId: string }
    return (
      <PublicPaymentLinkPage
        sessionId={sessionId}
        messages={runtime.usePaymentLinkMessages()}
        renderResolvedSession={(resolvedSessionId) => (
          <Navigate to="/pay/$sessionId" params={{ sessionId: resolvedSessionId }} replace />
        )}
      />
    )
  }

  function AccountantPortalRoute() {
    const { token } = useParams({ strict: false }) as { token: string }
    return (
      <div className="min-h-screen bg-background">
        <AccountantPortal token={token} apiBaseUrl={runtime.getApiUrl()} />
      </div>
    )
  }

  return {
    id: "@voyant-travel/finance-react#public-routes" as const,
    routes: {
      pay: { validateSearch: paymentSearchSchema, component: PayRoute },
      paymentLink: { component: PaymentLinkRoute },
      accountant: { component: AccountantPortalRoute },
    },
  }
}
