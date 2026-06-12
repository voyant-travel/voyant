"use client"

import type { AdminRoutePageProps } from "@voyantjs/admin"

import { PaymentDetailHost } from "../payment-detail-host.js"

/**
 * Packaged route page for the payment detail (route contribution
 * `finance-payments-detail`): binds the matched `$id` path param onto
 * {@link PaymentDetailHost}, which owns the operator-grade detail page.
 */
export default function FinancePaymentDetailRoutePage({ params }: AdminRoutePageProps) {
  return <PaymentDetailHost id={params.id ?? ""} />
}
