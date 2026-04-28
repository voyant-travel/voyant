"use client"

import {
  type LegalContractAttachmentRecord,
  type LegalContractRecord,
  useLegalContractAttachments,
  useLegalContractMutation,
  useLegalContracts,
} from "@voyantjs/legal-react"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { Download, FileText, Loader2, RotateCw } from "lucide-react"

/**
 * Status → badge style map. Keeps the card visually in sync with the
 * contract detail page (same variant names, same ordering of severity).
 */
const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  issued: "secondary",
  sent: "secondary",
  signed: "default",
  executed: "default",
  expired: "destructive",
  void: "destructive",
}

export interface BookingContractCardLabels {
  heading?: string
  empty?: string
  /** Button text when the contract has no document yet. */
  generate?: string
  /** Button text when the contract already has a document. */
  regenerate?: string
  download?: string
  noAttachments?: string
  issuedAt?: string
  contractNumber?: string
  unsaved?: string
}

const DEFAULT_LABELS = {
  heading: "Contract",
  empty: "No contract has been generated for this booking yet.",
  generate: "Generate",
  regenerate: "Regenerate",
  download: "Download",
  noAttachments: "No documents attached yet.",
  issuedAt: "Issued",
  contractNumber: "#",
  unsaved: "Pending",
} as const

export interface BookingContractCardProps {
  /** Booking whose contracts we list. Required — the card filters server-side. */
  bookingId: string
  /**
   * API base for attachment download redirects (default: same origin). Use
   * this when the operator admin app proxies through a different host than
   * the API — the browser needs an absolute URL to open the 302 in a new
   * tab correctly.
   */
  apiBaseUrl?: string
  labels?: BookingContractCardLabels
}

/**
 * Operator booking-detail "Contract" card. Mount next to the payments / docs
 * card on the booking detail page. Responsibilities are deliberately narrow:
 *  - List contracts linked to this booking
 *  - Show each contract's latest status + number
 *  - Let the operator download the generated PDF (opens in a new tab)
 *  - Let the operator force a regeneration when the template or booking
 *    data has changed
 *
 * Contract creation itself is handled by the `booking.confirmed` auto-
 * generate subscriber (or manually from the contract-template admin page).
 * This card is the consumer surface — if no contract exists, the empty
 * state explains the flow rather than offering a "Create" button (which
 * would require a template picker, out of scope here).
 */
export function BookingContractCard({ bookingId, apiBaseUrl, labels }: BookingContractCardProps) {
  const merged = { ...DEFAULT_LABELS, ...labels }
  const contractsQuery = useLegalContracts({ bookingId, limit: 25 })
  const contracts = contractsQuery.data?.data ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" />
          {merged.heading}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {contractsQuery.isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          </div>
        ) : contracts.length === 0 ? (
          <p className="text-xs text-muted-foreground">{merged.empty}</p>
        ) : (
          contracts.map((contract) => (
            <BookingContractRow
              key={contract.id}
              contract={contract}
              apiBaseUrl={apiBaseUrl}
              labels={merged}
            />
          ))
        )}
      </CardContent>
    </Card>
  )
}

function BookingContractRow({
  contract,
  apiBaseUrl,
  labels,
}: {
  contract: LegalContractRecord
  apiBaseUrl?: string
  labels: Required<BookingContractCardLabels>
}) {
  const attachmentsQuery = useLegalContractAttachments({ contractId: contract.id })
  const attachments = attachmentsQuery.data ?? []
  const documentAttachments = attachments.filter(
    (a: LegalContractAttachmentRecord) => a.kind === "document",
  )
  const { generateDocument, regenerateDocument } = useLegalContractMutation()

  const isPending = generateDocument.isPending || regenerateDocument.isPending
  const hasDocument = documentAttachments.length > 0

  const handleGenerate = () => {
    const mutation = hasDocument ? regenerateDocument : generateDocument
    mutation.mutate({ id: contract.id, input: { replaceExisting: true, kind: "document" } })
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">
            {labels.contractNumber}
            {contract.contractNumber ?? labels.unsaved}
          </span>
          <Badge variant={STATUS_VARIANT[contract.status] ?? "outline"} className="text-[10px]">
            {contract.status}
          </Badge>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleGenerate}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RotateCw className="h-3.5 w-3.5" />
          )}
          <span className="ml-1 text-xs">{hasDocument ? labels.regenerate : labels.generate}</span>
        </Button>
      </div>

      {contract.issuedAt ? (
        <p className="text-[11px] text-muted-foreground">
          {labels.issuedAt}: {new Date(contract.issuedAt).toLocaleDateString()}
        </p>
      ) : null}

      {documentAttachments.length > 0 ? (
        <div className="flex flex-col gap-1">
          {documentAttachments.map((attachment) => (
            <AttachmentDownloadRow
              key={attachment.id}
              attachment={attachment}
              apiBaseUrl={apiBaseUrl}
              downloadLabel={labels.download}
            />
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">{labels.noAttachments}</p>
      )}
    </div>
  )
}

function AttachmentDownloadRow({
  attachment,
  apiBaseUrl,
  downloadLabel,
}: {
  attachment: LegalContractAttachmentRecord
  apiBaseUrl?: string
  downloadLabel: string
}) {
  // The download endpoint returns a 302 to the signed URL. A plain <a> link
  // with target="_blank" lets the browser follow it and open the file in a
  // new tab. When apiBaseUrl is omitted we fall back to a relative URL,
  // which is correct for same-origin admin apps.
  const href = `${apiBaseUrl ?? ""}/v1/admin/legal/contracts/attachments/${attachment.id}/download`
  const sizeKb =
    typeof attachment.fileSize === "number" ? `${Math.round(attachment.fileSize / 1024)} KB` : null

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-xs hover:bg-muted"
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <FileText className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{attachment.name}</span>
        {sizeKb ? <span className="text-muted-foreground">· {sizeKb}</span> : null}
      </span>
      <span className="flex items-center gap-1 text-muted-foreground">
        <Download className="h-3 w-3" />
        {downloadLabel}
      </span>
    </a>
  )
}
