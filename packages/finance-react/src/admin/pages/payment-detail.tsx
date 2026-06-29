"use client"

import type { AdminRoutePageProps } from "@voyant-travel/admin"

import { PaymentDetailHost } from "../payment-detail-host.js"

/**
 * Packaged route page for the payment detail (route contribution
 * `finance-payments-detail`): binds the matched `$id` path param onto
 * {@link PaymentDetailHost}, which owns the operator-grade detail page.
 */
// fallow-ignore-next-line unused-export
export default function FinancePaymentDetailRoutePage({ params }: AdminRoutePageProps) {
  return <PaymentDetailHost id={params.id ?? ""} />
}
