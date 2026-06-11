"use client"

import { useAdminNavigate } from "@voyantjs/admin"
import { useSuppliers } from "@voyantjs/suppliers-react"
import { useState } from "react"

import { PaymentsPage } from "../../components/payments-page.js"
import { RecordPaymentDialog } from "../record-payment-dialog.js"

/**
 * Packaged route page for the payments list (route contribution
 * `finance-payments-index`). Owns the supplier-filter search state (the
 * supplier combobox options come from `@voyantjs/suppliers-react`), renders
 * the record-payment dialog, and resolves row activation through the shared
 * `payment.detail` semantic destination (packaged-admin RFC §4.7).
 */
export default function FinancePaymentsIndexRoutePage() {
  const navigateTo = useAdminNavigate()
  const [supplierSearch, setSupplierSearch] = useState("")
  const suppliersQuery = useSuppliers({ search: supplierSearch || undefined, limit: 20 })
  const supplierOptions = suppliersQuery.data?.data ?? []

  return (
    <PaymentsPage
      supplierOptions={supplierOptions}
      onSupplierSearchChange={setSupplierSearch}
      onOpenPayment={(id) => navigateTo("payment.detail", { paymentId: id })}
      renderRecordPaymentDialog={(props) => <RecordPaymentDialog {...props} />}
    />
  )
}
