"use client"

import { type AdminRoutePageProps, useAdminNavigate } from "@voyant-travel/admin"

import { SupplierInvoicesPage } from "../../components/supplier-invoices-page.js"
import { useSupplierPicker } from "../use-supplier-picker.js"

/**
 * Packaged route page for the supplier-invoices list: opens rows through the
 * `supplierInvoice.detail` destination and wires the create dialog's
 * supplier picker (search + inline create) through the suppliers package's
 * own client — see {@link useSupplierPicker}.
 */
export default function SupplierInvoicesIndexPage(_props: AdminRoutePageProps) {
  const navigateTo = useAdminNavigate()
  const { searchSuppliers, createSupplier } = useSupplierPicker()

  return (
    <SupplierInvoicesPage
      onOpenSupplierInvoice={(id) =>
        navigateTo("supplierInvoice.detail", { supplierInvoiceId: id })
      }
      searchSuppliers={searchSuppliers}
      createSupplier={createSupplier}
    />
  )
}
