"use client"

import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { Download, FilePlus2, FileText, Loader2, RotateCw } from "lucide-react"
import { useLegalUiI18nOrDefault } from "../i18n/index.js"
import type { LegalUiMessages } from "../i18n/messages.js"
import {
  type LegalContractAttachmentRecord,
  type LegalContractRecord,
  useDefaultLegalContractTemplate,
  useLegalContractAttachments,
  useLegalContractMutation,
  useLegalContractNumberSeries,
  useLegalContracts,
  useVoyantLegalContext,
} from "../index.js"

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

export type BookingContractCardLabels = Partial<
  Omit<LegalUiMessages["bookingContractCard"], "contractStatusLabels">
>

export interface BookingContractCardProps {
  /** Booking whose contracts we list. Required — the card filters server-side. */
  bookingId: string
  /** Contract scope used to resolve the default template + active number series. */
  contractScope?: "customer" | "supplier" | "partner" | "channel" | "other"
  /** Optional language preference for default-template resolution. */
  language?: string
  /** Optional channel preference for default-template resolution. */
  channelId?: string | null
  /** Optional language fallbacks for default-template resolution. */
  fallbackLanguages?: string[]
  /**
   * API base for attachment download redirects. Defaults to the active
   * `VoyantLegalProvider` base URL; override when a host needs a different
   * download origin than its data hooks use.
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
 * Contract creation is handled by the package booking generation endpoint.
 * The card only offers the action when the server-visible prerequisites
 * exist: a default template with a current version and exactly one active
 * number series for the selected scope.
 */
export function BookingContractCard({
  bookingId,
  contractScope = "customer",
  language,
  channelId,
  fallbackLanguages,
  apiBaseUrl,
  labels,
}: BookingContractCardProps) {
  const i18n = useLegalUiI18nOrDefault()
  const { baseUrl } = useVoyantLegalContext()
  const resolvedApiBaseUrl = apiBaseUrl ?? baseUrl
  const merged = { ...i18n.messages.bookingContractCard, ...labels }
  const contractsQuery = useLegalContracts({ bookingId, limit: 25 })
  const contracts = contractsQuery.data?.data ?? []
  const shouldCheckGeneration = !contractsQuery.isLoading && contracts.length === 0
  const defaultTemplateQuery = useDefaultLegalContractTemplate({
    scope: contractScope,
    language,
    channelId: channelId ?? undefined,
    fallbackLanguages,
    enabled: shouldCheckGeneration,
  })
  const numberSeriesQuery = useLegalContractNumberSeries({
    scope: contractScope,
    active: true,
    enabled: shouldCheckGeneration,
  })
  const { generateForBooking } = useLegalContractMutation()
  const activeSeries = numberSeriesQuery.data?.data ?? []
  const canGenerate =
    Boolean(defaultTemplateQuery.data?.currentVersionId) && activeSeries.length === 1
  const generationPrerequisitesLoaded =
    shouldCheckGeneration && !defaultTemplateQuery.isLoading && !numberSeriesQuery.isLoading

  const handleGenerateForBooking = () => {
    generateForBooking.mutate({
      bookingId,
      input: {
        scope: contractScope,
        language,
        channelId,
        fallbackLanguages,
        requireNumberSeries: true,
      },
    })
  }

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
            {i18n.messages.common.loading}
          </div>
        ) : contracts.length === 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">{merged.empty}</p>
            {generationPrerequisitesLoaded && canGenerate ? (
              <Button
                type="button"
                size="sm"
                onClick={handleGenerateForBooking}
                disabled={generateForBooking.isPending}
                className="w-fit"
              >
                {generateForBooking.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FilePlus2 className="h-3.5 w-3.5" />
                )}
                <span className="ml-1 text-xs">
                  {generateForBooking.isPending ? merged.generating : merged.generateContract}
                </span>
              </Button>
            ) : generationPrerequisitesLoaded ? (
              <p className="text-[11px] text-muted-foreground">{merged.generateUnavailable}</p>
            ) : null}
          </div>
        ) : (
          contracts.map((contract) => (
            <BookingContractRow
              key={contract.id}
              contract={contract}
              apiBaseUrl={resolvedApiBaseUrl}
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
  const i18n = useLegalUiI18nOrDefault()
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
            {i18n.messages.bookingContractCard.contractStatusLabels[contract.status]}
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
          {labels.issuedAt}: {i18n.formatDate(contract.issuedAt)}
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

function withApiBaseUrl(baseUrl: string, path: string) {
  const trimmedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${trimmedBase}${normalizedPath}`
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
  const i18n = useLegalUiI18nOrDefault()
  // The download endpoint returns a 302 to the signed URL. A plain <a> link
  // with target="_blank" lets the browser follow it and open the file in a
  // new tab. The href uses the same API base as the data hooks by default.
  const href = withApiBaseUrl(
    apiBaseUrl ?? "",
    `/v1/admin/legal/contracts/attachments/${attachment.id}/download`,
  )
  const sizeKb =
    typeof attachment.fileSize === "number"
      ? `${i18n.formatNumber(Math.round(attachment.fileSize / 1024))} ${i18n.messages.common.kilobytes}`
      : null

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
