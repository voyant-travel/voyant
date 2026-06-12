"use client"

import { useQueryClient } from "@tanstack/react-query"
import {
  type AdminRoutePageProps,
  useAdminBreadcrumbs,
  useAdminHref,
  useAdminNavigate,
} from "@voyantjs/admin"
import { getSlotsQueryOptions } from "@voyantjs/availability-react"
import { getBookingsQueryOptions } from "@voyantjs/bookings-react"
import { getProductsQueryOptions } from "@voyantjs/products-react"

import {
  type SupplierInvoiceAttachmentUpload,
  SupplierInvoiceDetailPage,
  type SupplierInvoiceTargetSearch,
} from "../../components/supplier-invoice-detail-page.js"
import { useSupplierInvoice } from "../../hooks/use-supplier-invoice.js"
import { useFinanceUiMessagesOrDefault } from "../../i18n/index.js"
import { useVoyantFinanceContext } from "../../provider.js"
import { useSupplierPicker } from "../use-supplier-picker.js"

/** New-tab open for download endpoints. No-op during SSR render passes. */
function openInNewTab(url: string): void {
  if (typeof window === "undefined") return
  window.open(url, "_blank", "noopener,noreferrer")
}

/**
 * Packaged route page for the supplier-invoice detail: binds the matched
 * `$id` param onto {@link SupplierInvoiceDetailPage} and carries the wiring
 * the operator route file used to hand-supply —
 *
 * - attachment uploads post to the template-level `/v1/uploads` route
 *   through the shared finance provider context (`baseUrl` + credentialed
 *   fetcher), the same path `BookingInvoicesWidget` uses;
 * - the allocation dialog's cross-domain target search composes the
 *   bookings / products / availability packages' own query options through
 *   that same context client;
 * - the supplier picker (search + inline create) rides the suppliers
 *   package's client — see {@link useSupplierPicker};
 * - document/attachment downloads and the back/breadcrumb links resolve
 *   through the finance API origin and the `supplierInvoice.list`
 *   destination.
 */
export default function SupplierInvoiceDetailRoutePage({ params }: AdminRoutePageProps) {
  const id = params.id ?? ""
  const navigateTo = useAdminNavigate()
  const resolveHref = useAdminHref()
  const queryClient = useQueryClient()
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const messages = useFinanceUiMessagesOrDefault().supplierInvoiceDetail
  const { data } = useSupplierInvoice(id)
  const invoiceNo = data?.data?.supplierInvoiceNo

  useAdminBreadcrumbs([
    { label: messages.breadcrumbRoot, href: resolveHref("supplierInvoice.list", {}) },
    ...(invoiceNo ? [{ label: invoiceNo }] : []),
  ])

  const client = { baseUrl, fetcher }

  const uploadAttachment = async (file: File): Promise<SupplierInvoiceAttachmentUpload> => {
    const body = new FormData()
    body.append("file", file)
    const response = await fetcher(`${baseUrl}/v1/uploads`, { method: "POST", body })
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`)
    }
    const uploaded = (await response.json()) as { key: string; mimeType?: string; size?: number }
    return {
      storageKey: uploaded.key,
      mimeType: uploaded.mimeType ?? file.type,
      fileSize: uploaded.size ?? file.size,
    }
  }

  const searchTargets: SupplierInvoiceTargetSearch = async (targetType, query) => {
    if (targetType === "product") {
      const result = await queryClient.fetchQuery(
        getProductsQueryOptions(client, { search: query || undefined, limit: 20 }),
      )
      return result.data.map((product) => ({
        value: product.id,
        label: `${product.name} (${product.id})`,
      }))
    }
    if (targetType === "booking") {
      const result = await queryClient.fetchQuery(
        getBookingsQueryOptions(client, { search: query || undefined, limit: 20 }),
      )
      return result.data.map((booking) => ({
        value: booking.id,
        label: `${booking.bookingNumber} (${booking.id})`,
      }))
    }
    if (targetType === "departure") {
      // Product-centric: search products by name, then list each product's
      // departures (slots). Label "<product> · <date>".
      const products = await queryClient.fetchQuery(
        getProductsQueryOptions(client, { search: query || undefined, limit: 6 }),
      )
      const nameById = new Map(products.data.map((product) => [product.id, product.name]))
      const slotLists = await Promise.all(
        products.data.map((product) =>
          queryClient.fetchQuery(
            getSlotsQueryOptions(client, { productId: product.id, limit: 10 }),
          ),
        ),
      )
      return slotLists.flatMap((result) =>
        result.data.map((slot) => ({
          value: slot.id,
          label: `${nameById.get(slot.productId) ?? slot.productId} · ${slot.dateLocal}`,
        })),
      )
    }
    return []
  }

  // Two-step departure picker: list a chosen product's departures (slots).
  const listDeparturesForProduct = async (productId: string, query: string) => {
    const result = await queryClient.fetchQuery(
      getSlotsQueryOptions(client, { productId, limit: 50 }),
    )
    const normalized = query.trim().toLowerCase()
    return result.data
      .filter((slot) => !normalized || slot.dateLocal.toLowerCase().includes(normalized))
      .map((slot) => ({ value: slot.id, label: slot.dateLocal }))
  }

  const { searchSuppliers, createSupplier } = useSupplierPicker()

  return (
    <SupplierInvoiceDetailPage
      id={id}
      onBack={() => navigateTo("supplierInvoice.list", {})}
      onDownloadDocument={() =>
        openInNewTab(`${baseUrl}/v1/admin/finance/supplier-invoices/${id}/document/download`)
      }
      uploadFile={uploadAttachment}
      searchTargets={searchTargets}
      listDeparturesForProduct={listDeparturesForProduct}
      searchSuppliers={searchSuppliers}
      createSupplier={createSupplier}
      onDownloadAttachment={(attachmentId) =>
        openInNewTab(
          `${baseUrl}/v1/admin/finance/supplier-invoice-attachments/${attachmentId}/download`,
        )
      }
    />
  )
}
