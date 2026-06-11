"use client"

import { useAdminNavigate } from "@voyantjs/admin"

import { InvoicesPage } from "../../components/invoices-page.js"

/**
 * Packaged route page for the invoices list (route contribution
 * `finance-invoices-index`). Row activation resolves through the shared
 * `invoice.detail` semantic destination (packaged-admin RFC §4.7), so the
 * page stays host-agnostic — no router import, no route file in the host.
 */
export default function FinanceInvoicesIndexRoutePage() {
  const navigateTo = useAdminNavigate()

  return <InvoicesPage onOpenInvoice={(id) => navigateTo("invoice.detail", { invoiceId: id })} />
}
