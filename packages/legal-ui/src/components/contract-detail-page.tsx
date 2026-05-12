import { useQueryClient } from "@tanstack/react-query"
import { formatMessage } from "@voyantjs/i18n"
import {
  type LegalContractAttachmentRecord,
  type LegalContractRecord,
  useLegalContract,
  useLegalContractAttachmentMutation,
  useLegalContractAttachments,
  useLegalContractMutation,
  useLegalContractSignatures,
} from "@voyantjs/legal-react"
import { Badge, Button } from "@voyantjs/ui/components"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyantjs/ui/components/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@voyantjs/ui/components/tabs"
import { ArrowLeft, ExternalLink, FileText, Pencil, Plus, Trash2 } from "lucide-react"
import type { ReactNode } from "react"
import { useState } from "react"

import { useLegalUiI18nOrDefault, useLegalUiMessagesOrDefault } from "../i18n/index.js"
import type { LegalContractStatusValue } from "../i18n/messages.js"
import { AttachmentDialog } from "./attachment-dialog.js"
import { SignatureDialog } from "./signature-dialog.js"

const statusVariant: Record<
  LegalContractStatusValue,
  "default" | "secondary" | "outline" | "destructive"
> = {
  draft: "outline",
  issued: "secondary",
  sent: "secondary",
  signed: "default",
  executed: "default",
  expired: "destructive",
  void: "destructive",
}

export interface ContractDetailPageProps {
  id: string
  onBackToContracts?: () => void
  renderContractDialog?: (props: ContractDetailDialogRenderProps) => ReactNode
  renderReference?: (props: ContractReferenceRenderProps) => ReactNode
  getAttachmentDownloadHref?: (attachment: LegalContractAttachmentRecord) => string
}

export type ContractReferenceKind =
  | "person"
  | "organization"
  | "supplier"
  | "channel"
  | "booking"
  | "order"

export interface ContractReferenceRenderProps {
  kind: ContractReferenceKind
  id: string
  contract: LegalContractRecord
}

export interface ContractDetailDialogRenderProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contract: LegalContractRecord
  onSuccess: () => void
}

export function ContractDetailPage({
  id,
  onBackToContracts,
  renderContractDialog,
  renderReference,
  getAttachmentDownloadHref,
}: ContractDetailPageProps) {
  const queryClient = useQueryClient()
  const i18n = useLegalUiI18nOrDefault()
  const messages = useLegalUiMessagesOrDefault()
  const f = messages.contractDetailPage
  const { remove, issue, voidContract } = useLegalContractMutation()
  const { remove: removeAttachment } = useLegalContractAttachmentMutation()

  const [editOpen, setEditOpen] = useState(false)
  const [signOpen, setSignOpen] = useState(false)
  const [attachOpen, setAttachOpen] = useState(false)
  const [editingAttachment, setEditingAttachment] = useState<
    LegalContractAttachmentRecord | undefined
  >()

  const { data: contract, isPending } = useLegalContract(id)
  const { data: signatures, refetch: refetchSignatures } = useLegalContractSignatures({
    contractId: id,
  })
  const { data: attachments, refetch: refetchAttachments } = useLegalContractAttachments({
    contractId: id,
  })

  if (isPending) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">{messages.common.loading}</p>
        </div>
      </div>
    )
  }

  if (!contract) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">{f.notFound}</p>
        {onBackToContracts ? (
          <Button variant="outline" onClick={onBackToContracts}>
            {f.backToContracts}
          </Button>
        ) : null}
      </div>
    )
  }

  const status = contract.status
  const canAddSignature = status === "issued" || status === "sent" || status === "signed"
  const renderReferenceValue = (kind: ContractReferenceKind, referenceId: string) =>
    renderReference?.({ kind, id: referenceId, contract }) ?? (
      <span className="font-mono text-xs">{referenceId}</span>
    )

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        {onBackToContracts ? (
          <Button variant="ghost" size="icon" onClick={onBackToContracts}>
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Button>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{f.title}</h1>
            <Badge variant={statusVariant[status] ?? "secondary"}>
              {messages.common.contractStatusLabels[status] ?? status}
            </Badge>
            <Badge variant="outline">
              {messages.common.contractScopeLabels[
                contract.scope as keyof typeof messages.common.contractScopeLabels
              ] ?? contract.scope}
            </Badge>
          </div>
          <p className="mt-1 truncate font-mono text-muted-foreground text-sm">
            {contract.contractNumber ?? contract.title}
          </p>
          {contract.contractNumber ? (
            <p className="mt-1 truncate text-muted-foreground text-xs">{contract.title}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {status === "draft" ? (
            <Button size="sm" onClick={() => issue.mutate(id)} disabled={issue.isPending}>
              {f.actions.issue}
            </Button>
          ) : null}
          {status !== "void" ? (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                if (confirm(f.voidConfirm)) {
                  voidContract.mutate(id)
                }
              }}
              disabled={voidContract.isPending}
            >
              {f.actions.void}
            </Button>
          ) : null}
          {renderContractDialog ? (
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 size-4" aria-hidden="true" />
              {messages.common.edit}
            </Button>
          ) : null}
          {status === "draft" ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (confirm(formatMessage(f.deleteConfirm, { title: contract.title }))) {
                  remove.mutate(id, { onSuccess: () => onBackToContracts?.() })
                }
              }}
              disabled={remove.isPending}
            >
              <Trash2 className="mr-2 size-4" aria-hidden="true" />
              {messages.common.delete}
            </Button>
          ) : null}
        </div>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">{f.sections.details}</TabsTrigger>
          <TabsTrigger value="parties">{f.sections.parties}</TabsTrigger>
          <TabsTrigger value="signatures">{f.sections.signatures}</TabsTrigger>
          <TabsTrigger value="documents">{f.sections.documents}</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="mt-4">
          <ContractSection title={f.sections.details}>
            <div className="grid gap-3 text-sm">
              <DetailRow label={f.fields.language}>{contract.language}</DetailRow>
              {contract.templateVersionId ? (
                <DetailRow label={f.fields.templateVersion}>
                  <span className="font-mono text-xs">{contract.templateVersionId}</span>
                </DetailRow>
              ) : null}
              {contract.seriesId ? (
                <DetailRow label={f.fields.series}>
                  <span className="font-mono text-xs">{contract.seriesId}</span>
                </DetailRow>
              ) : null}
              {contract.expiresAt ? (
                <DetailRow label={f.fields.expires}>
                  {i18n.formatDate(contract.expiresAt)}
                </DetailRow>
              ) : null}
              <div className="mt-2 border-t pt-3">
                <DetailRow label={f.fields.created}>
                  {i18n.formatDate(contract.createdAt)}
                </DetailRow>
                <DetailRow label={f.fields.updated}>
                  {i18n.formatDate(contract.updatedAt)}
                </DetailRow>
              </div>
            </div>
          </ContractSection>
        </TabsContent>
        <TabsContent value="parties" className="mt-4">
          <ContractSection title={f.sections.parties}>
            <div className="grid gap-3 text-sm">
              {contract.personId ? (
                <DetailRow label={f.fields.person}>
                  {renderReferenceValue("person", contract.personId)}
                </DetailRow>
              ) : null}
              {contract.organizationId ? (
                <DetailRow label={f.fields.organization}>
                  {renderReferenceValue("organization", contract.organizationId)}
                </DetailRow>
              ) : null}
              {contract.supplierId ? (
                <DetailRow label={f.fields.supplier}>
                  {renderReferenceValue("supplier", contract.supplierId)}
                </DetailRow>
              ) : null}
              {contract.channelId ? (
                <DetailRow label={f.fields.channel}>
                  {renderReferenceValue("channel", contract.channelId)}
                </DetailRow>
              ) : null}
              {contract.bookingId ? (
                <DetailRow label={f.fields.booking}>
                  {renderReferenceValue("booking", contract.bookingId)}
                </DetailRow>
              ) : null}
              {contract.orderId ? (
                <DetailRow label={f.fields.order}>
                  {renderReferenceValue("order", contract.orderId)}
                </DetailRow>
              ) : null}
              {!contract.personId &&
              !contract.organizationId &&
              !contract.supplierId &&
              !contract.channelId &&
              !contract.bookingId &&
              !contract.orderId ? (
                <p className="text-muted-foreground">{f.empty.noParties}</p>
              ) : null}
            </div>
          </ContractSection>
        </TabsContent>
        <TabsContent value="signatures" className="mt-4">
          <ContractSection
            title={f.sections.signatures}
            action={
              canAddSignature ? (
                <Button size="sm" onClick={() => setSignOpen(true)}>
                  <Plus className="mr-2 size-4" aria-hidden="true" />
                  {f.actions.addSignature}
                </Button>
              ) : null
            }
          >
            {!signatures || signatures.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {f.empty.noSignatures}
              </p>
            ) : (
              <div className="rounded border bg-background">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{f.fields.name}</TableHead>
                      <TableHead>{f.fields.email}</TableHead>
                      <TableHead>{f.fields.role}</TableHead>
                      <TableHead>{f.fields.method}</TableHead>
                      <TableHead>{f.fields.signedAt}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {signatures.map((signature) => (
                      <TableRow key={signature.id}>
                        <TableCell>{signature.signerName}</TableCell>
                        <TableCell>
                          {signature.signerEmail ?? messages.common.noResultsDash}
                        </TableCell>
                        <TableCell>
                          {signature.signerRole ?? messages.common.noResultsDash}
                        </TableCell>
                        <TableCell>{signature.method}</TableCell>
                        <TableCell>{i18n.formatDateTime(signature.signedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </ContractSection>
        </TabsContent>
        <TabsContent value="documents" className="mt-4">
          <ContractSection
            title={f.sections.documents}
            action={
              <Button
                size="sm"
                onClick={() => {
                  setEditingAttachment(undefined)
                  setAttachOpen(true)
                }}
              >
                <Plus className="mr-2 size-4" aria-hidden="true" />
                {f.actions.addDocument}
              </Button>
            }
          >
            {!attachments || attachments.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {f.empty.noAttachments}
              </p>
            ) : (
              <div className="rounded border bg-background">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{f.fields.name}</TableHead>
                      <TableHead>{f.fields.kind}</TableHead>
                      <TableHead>{f.fields.mimeType}</TableHead>
                      <TableHead>{f.fields.size}</TableHead>
                      <TableHead className="w-16" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attachments.map((attachment) => (
                      <AttachmentRow
                        key={attachment.id}
                        attachment={attachment}
                        downloadHref={getAttachmentDownloadHref?.(attachment)}
                        onEdit={() => {
                          setEditingAttachment(attachment)
                          setAttachOpen(true)
                        }}
                        onDelete={() => {
                          if (confirm(f.deleteAttachmentConfirm)) {
                            removeAttachment.mutate({ contractId: id, id: attachment.id })
                          }
                        }}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </ContractSection>
        </TabsContent>
      </Tabs>

      {renderContractDialog?.({
        open: editOpen,
        onOpenChange: setEditOpen,
        contract,
        onSuccess: () => {
          setEditOpen(false)
          void queryClient.invalidateQueries()
        },
      })}

      <SignatureDialog
        open={signOpen}
        onOpenChange={setSignOpen}
        contractId={id}
        onSuccess={() => {
          setSignOpen(false)
          void refetchSignatures()
          void queryClient.invalidateQueries()
        }}
      />

      <AttachmentDialog
        open={attachOpen}
        onOpenChange={setAttachOpen}
        contractId={id}
        attachment={editingAttachment}
        onSuccess={() => {
          setAttachOpen(false)
          setEditingAttachment(undefined)
          void refetchAttachments()
        }}
      />
    </div>
  )
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}:</span> <span>{children}</span>
    </div>
  )
}

function ContractSection({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-md border bg-background">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <h2 className="font-semibold text-sm">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

function AttachmentRow({
  attachment,
  downloadHref,
  onEdit,
  onDelete,
}: {
  attachment: LegalContractAttachmentRecord
  downloadHref?: string
  onEdit: () => void
  onDelete: () => void
}) {
  const messages = useLegalUiMessagesOrDefault()
  const f = messages.contractDetailPage

  return (
    <TableRow>
      <TableCell>
        {downloadHref ? (
          <a
            href={downloadHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 hover:underline"
          >
            <FileText className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
            <span className="truncate">{attachment.name}</span>
            <ExternalLink className="size-3 opacity-60" aria-hidden="true" />
          </a>
        ) : (
          <span>{attachment.name}</span>
        )}
      </TableCell>
      <TableCell>{attachment.kind}</TableCell>
      <TableCell>{attachment.mimeType ?? messages.common.noResultsDash}</TableCell>
      <TableCell>
        {attachment.fileSize != null
          ? formatBytes(attachment.fileSize, {
              bytes: f.units.bytes,
              kilobytes: f.units.kilobytes,
              megabytes: f.units.megabytes,
            })
          : messages.common.noResultsDash}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="text-muted-foreground hover:text-foreground"
          >
            <Pencil className="size-3" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3" aria-hidden="true" />
          </button>
        </div>
      </TableCell>
    </TableRow>
  )
}

function formatBytes(
  bytes: number,
  units: { bytes: string; kilobytes: string; megabytes: string },
): string {
  if (bytes < 1024) return `${bytes} ${units.bytes}`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} ${units.kilobytes}`
  return `${(bytes / (1024 * 1024)).toFixed(1)} ${units.megabytes}`
}
