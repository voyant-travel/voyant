"use client"

import type { AdminRoutePageProps } from "@voyant-travel/admin"

import { InvoiceDetailHost } from "../invoice-detail-host.js"

/**
 * Packaged route page for the invoice detail (route contribution
 * `finance-invoices-detail`): binds the matched `$id` path param onto
 * {@link InvoiceDetailHost}, which owns the operator-grade detail page.
 */
export default function FinanceInvoiceDetailRoutePage({ params }: AdminRoutePageProps) {
  return <InvoiceDetailHost id={params.id ?? ""} />
}
