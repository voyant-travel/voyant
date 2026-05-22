"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  type BookingTravelerRecord,
  useBooking,
  useBookingTravelerDocumentMutation,
  useBookingTravelerDocuments,
  useTravelers,
} from "@voyantjs/bookings-react"
import { BookingDocumentDialog } from "@voyantjs/bookings-ui/components/booking-document-dialog"
import {
  type LegalContractAttachmentRecord,
  type LegalContractRecord,
  useLegalContractAttachments,
  useLegalContracts,
} from "@voyantjs/legal-react"
import { Badge } from "@voyantjs/ui/components/badge"
import { Button } from "@voyantjs/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components/card"
import { Download, ExternalLink, FileText, Loader2, Plus, RotateCw, Trash2 } from "lucide-react"
import { useState } from "react"
import { useAdminMessages } from "@/lib/admin-i18n"

type DocumentsTableMessages = ReturnType<
  typeof useAdminMessages
>["bookings"]["detail"]["documentsTable"]

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
  const t = useAdminMessages().bookings.detail.documentsTable

  const bookingQuery = useBooking(bookingId)
  const booking = bookingQuery.data?.data ?? null

  const contractsQuery = useLegalContracts({ bookingId, limit: 25 })
  const contracts = contractsQuery.data?.data ?? []

  const travelerDocsQuery = useBookingTravelerDocuments(bookingId)
  const travelerDocs = travelerDocsQuery.data?.data ?? []

  const travelersQuery = useTravelers(bookingId)
  const travelersById = new Map((travelersQuery.data?.data ?? []).map((t) => [t.id, t]))

  const removeTravelerDoc = useBookingTravelerDocumentMutation(bookingId).remove

  const [contractGenerating, setContractGenerating] = useState(false)
  const queryClient = useQueryClient()
  const generatingContract = contractGenerating

  const handleGenerateContract = async (_templateId?: string) => {
    if (!booking) return
    // Delegates to the operator template's
    // `/v1/admin/bookings/:id/generate-contract` route, which runs the
    // same `autoGenerateContractForBooking` flow as the
    // `booking.confirmed` subscriber. That path resolves the default
    // customer-sales-agreement template, builds the booking +
    // customer + operator + totals variables, and renders the PDF.
    // The manual two-step flow we used before (create contract, then
    // generateDocument) skipped the variable build and produced blank
    // PDFs — the Liquid placeholders had no data.
    setContractGenerating(true)
    try {
      const response = await fetch(`/api/v1/admin/bookings/${booking.id}/generate-contract`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: response.statusText }))
        throw new Error((body as { error?: string }).error ?? `HTTP ${response.status}`)
      }
      // Refresh the contracts query — TanStack invalidates by prefix
      // so this also picks up the nested per-contract attachments
      // queries the rows depend on.
      await queryClient.invalidateQueries({ queryKey: ["legal", "contracts"] })
    } finally {
      setContractGenerating(false)
    }
  }

  const isLoading =
    bookingQuery.isLoading || contractsQuery.isLoading || travelerDocsQuery.isLoading
  const totalRows = contracts.length + travelerDocs.length

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-muted-foreground" />
          {t.title}
          {totalRows > 0 ? (
            <Badge variant="outline" className="text-[10px]">
              {totalRows}
            </Badge>
          ) : null}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleGenerateContract()}
            disabled={generatingContract || !booking}
            title={t.generateContractTooltip}
          >
            {generatingContract ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileText className="mr-1.5 h-3.5 w-3.5" />
            )}
            {t.generateContract}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setUploadOpen(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            {t.uploadDocument}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-hidden p-0">
        {isLoading ? (
          <p className="flex items-center justify-center gap-2 py-6 text-muted-foreground text-sm">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t.loading}
          </p>
        ) : totalRows === 0 ? (
          <p className="px-6 py-6 text-center text-muted-foreground text-sm">{t.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium">{t.headerCategory}</th>
                  <th className="px-4 py-2 text-left font-medium">{t.headerDocument}</th>
                  <th className="px-4 py-2 text-left font-medium">{t.headerFor}</th>
                  <th className="px-4 py-2 text-left font-medium">{t.headerStatus}</th>
                  <th className="px-4 py-2 text-left font-medium">{t.headerDate}</th>
                  <th className="w-32 px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {contracts.map((contract) => (
                  <ContractRow
                    key={contract.id}
                    contract={contract}
                    apiBaseUrl={apiBaseUrl}
                    messages={t}
                  />
                ))}
                {travelerDocs.map((doc) => (
                  <TravelerDocRow
                    key={doc.id}
                    doc={doc}
                    traveler={doc.travelerId ? (travelersById.get(doc.travelerId) ?? null) : null}
                    onDelete={() => removeTravelerDoc.mutate(doc.id)}
                    messages={t}
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
  messages,
}: {
  contract: LegalContractRecord
  apiBaseUrl?: string
  messages: DocumentsTableMessages
}): React.ReactElement {
  const attachmentsQuery = useLegalContractAttachments({ contractId: contract.id })
  const attachments = (attachmentsQuery.data ?? []).filter(
    (a: LegalContractAttachmentRecord) => a.kind === "document",
  )
  const latest = attachments[0] ?? null
  const hasDocument = latest !== null
  const queryClient = useQueryClient()
  // Both Generate and Regenerate post to the booking-scoped endpoint so the
  // variables (booking number, customer, totals) are rebuilt from current
  // booking data. `force: true` on Regenerate deletes the existing document
  // + clears renderedBody so the template re-renders with the new values —
  // the legacy `regenerateDocument` mutation re-ran the PDF printer over
  // whatever was previously cached on the contract row, which is why
  // placeholders looked unfilled.
  const generate = useMutation({
    mutationFn: async ({ bookingId, force }: { bookingId: string; force: boolean }) => {
      const response = await fetch(`/api/v1/admin/bookings/${bookingId}/generate-contract`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: response.statusText }))
        throw new Error((body as { error?: string }).error ?? `HTTP ${response.status}`)
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["legal", "contracts"] })
    },
  })
  const isPending = generate.isPending

  const handleGenerate = () => {
    if (!contract.bookingId) return
    generate.mutate({ bookingId: contract.bookingId, force: hasDocument })
  }

  // Hono is mounted at `/api/*` on this template (see entry.ts), so the
  // download URL must include the `/api` prefix. Defaulting here keeps
  // the link safe even when a caller forgets to plumb `apiBaseUrl` —
  // an empty base would otherwise produce a bare `/v1/...` path that
  // the SSR catch-all returns 404 for.
  const downloadHref = latest
    ? `${apiBaseUrl ?? "/api"}/v1/admin/legal/contracts/attachments/${latest.id}/download`
    : null
  const titleText = latest?.name ?? contract.contractNumber ?? `Contract ${contract.id.slice(-8)}`
  const statusVariant = CONTRACT_STATUS_VARIANT[contract.status] ?? "outline"
  const dateIso = contract.issuedAt ?? contract.createdAt ?? null
  const dateLabel = hasDocument ? messages.contractIssuedLabel : messages.contractPendingSinceLabel

  return (
    <tr className="border-b last:border-b-0">
      <td className="px-4 py-2.5">
        <Badge variant="outline" className="text-[10px]">
          {messages.contractBadge}
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
      <td className="px-4 py-2.5 text-muted-foreground">{messages.forBooking}</td>
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
            title={
              hasDocument ? messages.contractRegenerateTooltip : messages.contractGenerateTooltip
            }
            className="h-7 px-2"
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCw className="h-3.5 w-3.5" />
            )}
            <span className="ml-1 text-xs">
              {hasDocument ? messages.contractRegenerateAction : messages.contractGenerateAction}
            </span>
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
  messages,
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
  messages: DocumentsTableMessages
}): React.ReactElement {
  const scope = traveler
    ? `${traveler.firstName ?? ""} ${traveler.lastName ?? ""}`.trim() || messages.travelerFallback
    : messages.forBooking
  const isExpired =
    doc.expiresAt && Number.isFinite(new Date(doc.expiresAt).getTime())
      ? new Date(doc.expiresAt).getTime() < Date.now()
      : false
  const variant: "default" | "secondary" | "outline" | "destructive" = isExpired
    ? "destructive"
    : (TRAVELER_DOC_VARIANT[doc.type] ?? "outline")
  const dateIso = doc.expiresAt ?? doc.createdAt ?? null
  const dateLabel = doc.expiresAt ? messages.travelerExpiresLabel : messages.travelerUploadedLabel

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
        <Badge variant={variant}>
          {isExpired ? messages.travelerStatusExpired : messages.travelerStatusOnFile}
        </Badge>
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
            aria-label={messages.downloadDocumentAria}
          >
            <Download className="h-3.5 w-3.5" />
          </a>
          <button
            type="button"
            onClick={() => {
              if (confirm(messages.deleteConfirm)) onDelete()
            }}
            className="text-muted-foreground hover:text-destructive"
            aria-label={messages.deleteDocumentAria}
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
