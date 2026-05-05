"use client"

import {
  type BookingTravelerRecord,
  useBookingTravelerDocumentMutation,
  useBookingTravelerDocuments,
  useTravelers,
} from "@voyantjs/bookings-react"
import { BookingDocumentDialog } from "@voyantjs/bookings-ui/components/booking-document-dialog"
import {
  type LegalContractAttachmentRecord,
  type LegalContractRecord,
  useLegalContractAttachments,
  useLegalContractMutation,
  useLegalContracts,
} from "@voyantjs/legal-react"
import { Badge } from "@voyantjs/ui/components/badge"
import { Button } from "@voyantjs/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components/card"
import { Download, ExternalLink, FileText, Loader2, Plus, RotateCw, Trash2 } from "lucide-react"
import { useState } from "react"

/**
 * Unified Documents tab for a booking. Replaces the old split between
 * "Contract" and "Documents" cards by flattening every document
 * artifact attached to the booking into a single data-table:
 *
 *   - Auto-generated **legal contracts** + their PDF attachments
 *     (one row per contract — Generate / Regenerate / Download)
 *   - Per-traveler **documents** (passport, visa, insurance, …)
 *
 * Operators see them in one consistent table with a category badge.
 * Contracts render first (canonical booking docs), traveler-uploaded
 * documents below — each contract row handles its own attachment
 * fetch via the `useLegalContractAttachments` hook so we don't need
 * a join endpoint on the server.
 */
export interface BookingDocumentsTableProps {
  bookingId: string
  /**
   * API base URL for download redirects. Defaults to relative — the
   * operator dashboard is typically same-origin with the API.
   */
  apiBaseUrl?: string
}

const TRAVELER_DOC_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  visa: "default",
  insurance: "secondary",
  health: "secondary",
  passport_copy: "outline",
  other: "outline",
}

const CONTRACT_STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> =
  {
    draft: "outline",
    issued: "secondary",
    sent: "secondary",
    signed: "default",
    executed: "default",
    expired: "destructive",
    void: "destructive",
  }

export function BookingDocumentsTable({
  bookingId,
  apiBaseUrl,
}: BookingDocumentsTableProps): React.ReactElement {
  const [uploadOpen, setUploadOpen] = useState(false)

  const contractsQuery = useLegalContracts({ bookingId, limit: 25 })
  const contracts = contractsQuery.data?.data ?? []

  const travelerDocsQuery = useBookingTravelerDocuments(bookingId)
  const travelerDocs = travelerDocsQuery.data?.data ?? []

  const travelersQuery = useTravelers(bookingId)
  const travelersById = new Map((travelersQuery.data?.data ?? []).map((t) => [t.id, t]))

  const removeTravelerDoc = useBookingTravelerDocumentMutation(bookingId).remove

  const isLoading = contractsQuery.isLoading || travelerDocsQuery.isLoading
  const totalRows = contracts.length + travelerDocs.length

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Documents
          {totalRows > 0 ? (
            <Badge variant="outline" className="text-[10px]">
              {totalRows}
            </Badge>
          ) : null}
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => setUploadOpen(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Upload document
        </Button>
      </CardHeader>
      <CardContent className="overflow-hidden p-0">
        {isLoading ? (
          <p className="flex items-center justify-center gap-2 py-6 text-muted-foreground text-sm">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading documents…
          </p>
        ) : totalRows === 0 ? (
          <p className="px-6 py-6 text-center text-muted-foreground text-sm">
            No documents on this booking yet. Contracts auto-generate on confirmation; traveler
            documents (passport, visa, insurance) can be uploaded above.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium">Category</th>
                  <th className="px-4 py-2 text-left font-medium">Document</th>
                  <th className="px-4 py-2 text-left font-medium">For</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-left font-medium">Date</th>
                  <th className="w-32 px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {contracts.map((contract) => (
                  <ContractRow key={contract.id} contract={contract} apiBaseUrl={apiBaseUrl} />
                ))}
                {travelerDocs.map((doc) => (
                  <TravelerDocRow
                    key={doc.id}
                    doc={doc}
                    traveler={doc.travelerId ? (travelersById.get(doc.travelerId) ?? null) : null}
                    onDelete={() => removeTravelerDoc.mutate(doc.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <BookingDocumentDialog open={uploadOpen} onOpenChange={setUploadOpen} bookingId={bookingId} />
    </Card>
  )
}

/**
 * One row for a legal contract. Encapsulates the per-contract
 * attachments fetch + the generate/regenerate mutation so the parent
 * stays a flat list. Operators with no document yet see a "Generate"
 * action; once attached, they see Download (via the latest
 * attachment) + Regenerate (replaces the existing).
 */
function ContractRow({
  contract,
  apiBaseUrl,
}: {
  contract: LegalContractRecord
  apiBaseUrl?: string
}): React.ReactElement {
  const attachmentsQuery = useLegalContractAttachments({ contractId: contract.id })
  const attachments = (attachmentsQuery.data ?? []).filter(
    (a: LegalContractAttachmentRecord) => a.kind === "document",
  )
  const { generateDocument, regenerateDocument } = useLegalContractMutation()
  const isPending = generateDocument.isPending || regenerateDocument.isPending
  const latest = attachments[0] ?? null
  const hasDocument = latest !== null

  const handleGenerate = () => {
    const mutation = hasDocument ? regenerateDocument : generateDocument
    mutation.mutate({
      id: contract.id,
      input: { replaceExisting: true, kind: "document" },
    })
  }

  const downloadHref = latest
    ? `${apiBaseUrl ?? ""}/v1/admin/legal/contracts/attachments/${latest.id}/download`
    : null
  const titleText = latest?.name ?? contract.contractNumber ?? `Contract ${contract.id.slice(-8)}`
  const statusVariant = CONTRACT_STATUS_VARIANT[contract.status] ?? "outline"
  const dateIso = contract.issuedAt ?? contract.createdAt ?? null
  const dateLabel = hasDocument ? "Issued" : "Pending since"

  return (
    <tr className="border-b last:border-b-0">
      <td className="px-4 py-2.5">
        <Badge variant="outline" className="text-[10px]">
          Contract
        </Badge>
      </td>
      <td className="px-4 py-2.5">
        {downloadHref ? (
          <a
            href={downloadHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 hover:underline"
          >
            <FileText className="h-3.5 w-3.5 shrink-0 opacity-60" />
            <span className="truncate">{titleText}</span>
            <ExternalLink className="h-3 w-3 opacity-60" />
          </a>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <FileText className="h-3.5 w-3.5 shrink-0 opacity-60" />
            {titleText}
          </span>
        )}
        {latest?.fileSize != null ? (
          <span className="ml-2 text-muted-foreground text-xs">{formatBytes(latest.fileSize)}</span>
        ) : null}
      </td>
      <td className="px-4 py-2.5 text-muted-foreground">Booking</td>
      <td className="px-4 py-2.5">
        <Badge variant={statusVariant}>{contract.status.replace(/_/g, " ")}</Badge>
      </td>
      <td className="px-4 py-2.5 text-muted-foreground text-xs">
        {dateIso ? (
          <>
            <span className="opacity-60">{dateLabel} </span>
            {formatDate(dateIso)}
          </>
        ) : (
          "—"
        )}
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleGenerate}
            disabled={isPending}
            title={hasDocument ? "Regenerate PDF from current template" : "Generate PDF"}
            className="h-7 px-2"
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCw className="h-3.5 w-3.5" />
            )}
            <span className="ml-1 text-xs">{hasDocument ? "Regenerate" : "Generate"}</span>
          </Button>
        </div>
      </td>
    </tr>
  )
}

/**
 * One row for a per-traveler document (passport, visa, insurance, …).
 * Manually-uploaded; no auto-generation. Action column has download +
 * delete; a destructive badge surfaces expired documents.
 */
function TravelerDocRow({
  doc,
  traveler,
  onDelete,
}: {
  doc: {
    id: string
    type: string
    fileName: string
    fileUrl: string
    travelerId: string | null
    expiresAt: string | null
    notes: string | null
    createdAt: string
  }
  traveler: BookingTravelerRecord | null
  onDelete: () => void
}): React.ReactElement {
  const scope = traveler
    ? `${traveler.firstName ?? ""} ${traveler.lastName ?? ""}`.trim() || "Traveler"
    : "Booking"
  const isExpired =
    doc.expiresAt && Number.isFinite(new Date(doc.expiresAt).getTime())
      ? new Date(doc.expiresAt).getTime() < Date.now()
      : false
  const variant: "default" | "secondary" | "outline" | "destructive" = isExpired
    ? "destructive"
    : (TRAVELER_DOC_VARIANT[doc.type] ?? "outline")
  const dateIso = doc.expiresAt ?? doc.createdAt ?? null
  const dateLabel = doc.expiresAt ? "Expires" : "Uploaded"

  return (
    <tr className="border-b last:border-b-0">
      <td className="px-4 py-2.5">
        <Badge variant="outline" className="text-[10px]">
          {humanizeDocType(doc.type)}
        </Badge>
      </td>
      <td className="px-4 py-2.5">
        <a
          href={doc.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 hover:underline"
        >
          <FileText className="h-3.5 w-3.5 shrink-0 opacity-60" />
          <span className="truncate">{doc.fileName}</span>
          <ExternalLink className="h-3 w-3 opacity-60" />
        </a>
      </td>
      <td className="px-4 py-2.5 text-muted-foreground">{scope}</td>
      <td className="px-4 py-2.5">
        <Badge variant={variant}>{isExpired ? "Expired" : "On file"}</Badge>
      </td>
      <td className="px-4 py-2.5 text-muted-foreground text-xs">
        {dateIso ? (
          <>
            <span className="opacity-60">{dateLabel} </span>
            {formatDate(dateIso)}
          </>
        ) : (
          "—"
        )}
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center justify-end gap-1">
          <a
            href={doc.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground"
            aria-label="Download document"
          >
            <Download className="h-3.5 w-3.5" />
          </a>
          <button
            type="button"
            onClick={() => {
              if (confirm("Delete this document?")) onDelete()
            }}
            className="text-muted-foreground hover:text-destructive"
            aria-label="Delete document"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
}

function humanizeDocType(type: string): string {
  return type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    if (!Number.isFinite(d.getTime())) return iso
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
  } catch {
    return iso
  }
}
