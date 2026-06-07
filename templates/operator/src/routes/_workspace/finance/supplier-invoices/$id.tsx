import { useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useAdminBreadcrumbs } from "@voyantjs/admin"
import { getSlotsQueryOptions } from "@voyantjs/availability-react"
import { getBookingsQueryOptions } from "@voyantjs/bookings-react"
import { getSupplierInvoiceQueryOptions, useSupplierInvoice } from "@voyantjs/finance-react"
import {
  type SupplierInvoiceAttachmentUpload,
  SupplierInvoiceDetailPage,
  type SupplierInvoiceTargetSearch,
} from "@voyantjs/finance-ui"
import { getProductsQueryOptions } from "@voyantjs/products-react"

import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

async function uploadSupplierInvoiceAttachment(
  file: File,
): Promise<SupplierInvoiceAttachmentUpload> {
  const body = new FormData()
  body.append("file", file)
  const response = await fetch(`${getApiUrl()}/v1/uploads`, {
    method: "POST",
    credentials: "include",
    body,
  })
  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${response.statusText}`)
  }
  const data = (await response.json()) as { key: string; mimeType?: string; size?: number }
  return {
    storageKey: data.key,
    mimeType: data.mimeType ?? file.type,
    fileSize: data.size ?? file.size,
  }
}

export const Route = createFileRoute("/_workspace/finance/supplier-invoices/$id")({
  ssr: "data-only",
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      getSupplierInvoiceQueryOptions({ baseUrl: getApiUrl(), fetcher: operatorFetcher }, params.id),
    ),
  component: SupplierInvoiceDetailRoute,
})

function SupplierInvoiceDetailRoute() {
  const { id } = Route.useParams()
  const navigate = Route.useNavigate()
  const queryClient = useQueryClient()
  const { data } = useSupplierInvoice(id)
  const invoiceNo = data?.data?.supplierInvoiceNo

  useAdminBreadcrumbs([
    { label: "Supplier invoices", href: "/finance/supplier-invoices" },
    ...(invoiceNo ? [{ label: invoiceNo }] : []),
  ])

  const searchTargets: SupplierInvoiceTargetSearch = async (targetType, query) => {
    const client = { baseUrl: getApiUrl(), fetcher: operatorFetcher }
    if (targetType === "product") {
      const res = await queryClient.fetchQuery(
        getProductsQueryOptions(client, { search: query || undefined, limit: 20 }),
      )
      return res.data.map((p) => ({ value: p.id, label: `${p.name} (${p.id})` }))
    }
    if (targetType === "booking") {
      const res = await queryClient.fetchQuery(
        getBookingsQueryOptions(client, { search: query || undefined, limit: 20 }),
      )
      return res.data.map((b) => ({ value: b.id, label: `${b.bookingNumber} (${b.id})` }))
    }
    if (targetType === "departure") {
      // Product-centric: search products by name, then list each product's
      // departures (slots). Label "<product> · <date>".
      const products = await queryClient.fetchQuery(
        getProductsQueryOptions(client, { search: query || undefined, limit: 6 }),
      )
      const nameById = new Map(products.data.map((p) => [p.id, p.name]))
      const slotLists = await Promise.all(
        products.data.map((p) =>
          queryClient.fetchQuery(getSlotsQueryOptions(client, { productId: p.id, limit: 10 })),
        ),
      )
      return slotLists.flatMap((res) =>
        res.data.map((s) => ({
          value: s.id,
          label: `${nameById.get(s.productId) ?? s.productId} · ${s.dateLocal}`,
        })),
      )
    }
    return []
  }

  return (
    <SupplierInvoiceDetailPage
      id={id}
      onBack={() => void navigate({ to: "/finance/supplier-invoices" })}
      onDownloadDocument={() => {
        window.open(
          `${getApiUrl()}/v1/admin/finance/supplier-invoices/${id}/document/download`,
          "_blank",
          "noopener,noreferrer",
        )
      }}
      uploadFile={uploadSupplierInvoiceAttachment}
      searchTargets={searchTargets}
      onDownloadAttachment={(attachmentId) => {
        window.open(
          `${getApiUrl()}/v1/admin/finance/supplier-invoice-attachments/${attachmentId}/download`,
          "_blank",
          "noopener,noreferrer",
        )
      }}
    />
  )
}
