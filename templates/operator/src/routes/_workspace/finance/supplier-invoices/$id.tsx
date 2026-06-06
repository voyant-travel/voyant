import { createFileRoute } from "@tanstack/react-router"
import { getSupplierInvoiceQueryOptions } from "@voyantjs/finance-react"
import {
  type SupplierInvoiceAttachmentUpload,
  SupplierInvoiceDetailPage,
} from "@voyantjs/finance-ui"

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
