"use client"

import type {
  CreditNoteRecord,
  FinanceNoteRecord,
  InvoiceAttachmentRecord,
  InvoiceRecord,
  LineItemRecord,
  PaymentRecord,
} from "@voyantjs/finance-react"
import {
  useInvoice,
  useInvoiceAttachmentMutation,
  useInvoiceAttachments,
  useInvoiceCreditNotes,
  useInvoiceLineItemMutation,
  useInvoiceLineItems,
  useInvoiceMutation,
  useInvoiceNoteMutation,
  useInvoiceNotes,
  useInvoicePayments,
} from "@voyantjs/finance-react"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmActionButton,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from "@voyantjs/ui/components"
import { cn } from "@voyantjs/ui/lib/utils"
import { zodResolver } from "@voyantjs/ui/lib/zod-resolver"
import { ArrowLeft, ExternalLink, FileText, Loader2, Pencil, Plus } from "lucide-react"
import { type ReactNode, useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"

import { useFinanceUiI18nOrDefault, useFinanceUiMessagesOrDefault } from "../i18n/index.js"
import { InvoiceDialog } from "./invoice-dialog.js"

export interface InvoiceDetailPageSlots {
  afterHeader?: ReactNode
  afterSummary?: ReactNode
  lineItemsContent?: ReactNode
  afterLineItems?: ReactNode
  paymentsContent?: ReactNode
  afterPayments?: ReactNode
  creditNotesContent?: ReactNode
  afterCreditNotes?: ReactNode
  attachmentsContent?: ReactNode
  afterAttachments?: ReactNode
  notesContent?: ReactNode
  afterNotes?: ReactNode
  dialogs?: ReactNode
}

export interface InvoiceDetailPageProps {
  id: string
  className?: string
  onBack?: () => void
  onDeleted?: () => void
  onBookingOpen?: (bookingId: string, invoice: InvoiceRecord) => void
  onPersonOpen?: (personId: string, invoice: InvoiceRecord) => void
  onOrganizationOpen?: (organizationId: string, invoice: InvoiceRecord) => void
  onLineItemCreate?: (invoice: InvoiceRecord) => void
  onLineItemEdit?: (lineItem: LineItemRecord, invoice: InvoiceRecord) => void
  onPaymentCreate?: (invoice: InvoiceRecord) => void
  onCreditNoteCreate?: (invoice: InvoiceRecord) => void
  getAttachmentDownloadHref?: (attachment: InvoiceAttachmentRecord) => string | undefined
  renderInvoiceNoteDialog?: (props: InvoiceNoteDialogProps) => ReactNode
  slots?: InvoiceDetailPageSlots
}

export function InvoiceDetailPage({
  id,
  className,
  onBack,
  onDeleted,
  onBookingOpen,
  onPersonOpen,
  onOrganizationOpen,
  onLineItemCreate,
  onLineItemEdit,
  onPaymentCreate,
  onCreditNoteCreate,
  getAttachmentDownloadHref,
  renderInvoiceNoteDialog,
  slots,
}: InvoiceDetailPageProps) {
  const messages = useFinanceUiMessagesOrDefault()
  const [editOpen, setEditOpen] = useState(false)
  const [attachmentOpen, setAttachmentOpen] = useState(false)
  const [editingAttachment, setEditingAttachment] = useState<InvoiceAttachmentRecord | undefined>()
  const [noteOpen, setNoteOpen] = useState(false)

  const invoiceQuery = useInvoice(id)
  const invoice = invoiceQuery.data?.data
  const lineItemsQuery = useInvoiceLineItems(id, { enabled: Boolean(invoice) })
  const paymentsQuery = useInvoicePayments(id, { enabled: Boolean(invoice) })
  const creditNotesQuery = useInvoiceCreditNotes(id, { enabled: Boolean(invoice) })
  const attachmentsQuery = useInvoiceAttachments(id, { enabled: Boolean(invoice) })
  const notesQuery = useInvoiceNotes(id, { enabled: Boolean(invoice) })
  const { remove: removeInvoice } = useInvoiceMutation()
  const { remove: removeLineItem } = useInvoiceLineItemMutation(id)
  const { remove: removeAttachment } = useInvoiceAttachmentMutation(id)
  const addNote = useInvoiceNoteMutation(id)

  if (invoiceQuery.isPending) {
    return <InvoiceDetailLoading className={className} />
  }

  if (invoiceQuery.isError || !invoice) {
    return (
      <InvoiceDetailState
        className={className}
        message={
          invoiceQuery.isError
            ? invoiceQuery.error instanceof Error
              ? invoiceQuery.error.message
              : messages.invoiceDetailPage.states.loadFailed
            : messages.invoiceDetailPage.states.notFound
        }
        onBack={onBack}
      />
    )
  }

  const lineItems = lineItemsQuery.data?.data ?? []
  const payments = paymentsQuery.data?.data ?? []
  const creditNotes = creditNotesQuery.data?.data ?? []
  const attachments = attachmentsQuery.data?.data ?? []
  const notes = notesQuery.data?.data ?? []
  const handleCreateNote = async (nextContent: string) => {
    const content = nextContent.trim()
    if (!content) return
    await addNote.mutateAsync({ content })
    setNoteOpen(false)
    void notesQuery.refetch()
  }

  return (
    <div data-slot="invoice-detail-page" className={cn("flex flex-col gap-6 p-6", className)}>
      <InvoiceDetailHeader
        invoice={invoice}
        onBack={onBack}
        onEdit={() => setEditOpen(true)}
        deletePending={removeInvoice.isPending}
        onDelete={async () => {
          await removeInvoice.mutateAsync(id)
          onDeleted?.()
          onBack?.()
        }}
      />
      {slots?.afterHeader}

      <div className="grid gap-4 md:grid-cols-2">
        <InvoiceSummaryCard invoice={invoice} />
        <InvoiceLinksCard
          invoice={invoice}
          onBookingOpen={onBookingOpen}
          onPersonOpen={onPersonOpen}
          onOrganizationOpen={onOrganizationOpen}
        />
      </div>
      {slots?.afterSummary}

      {slots?.lineItemsContent !== undefined ? (
        slots.lineItemsContent
      ) : (
        <InvoiceLineItemsCard
          invoice={invoice}
          lineItems={lineItems}
          pending={lineItemsQuery.isPending}
          deletePending={removeLineItem.isPending}
          onCreate={onLineItemCreate}
          onEdit={onLineItemEdit}
          onDelete={async (lineItemId) => {
            await removeLineItem.mutateAsync(lineItemId)
          }}
        />
      )}
      {slots?.afterLineItems}

      {slots?.paymentsContent !== undefined ? (
        slots.paymentsContent
      ) : (
        <InvoicePaymentsCard
          invoice={invoice}
          payments={payments}
          pending={paymentsQuery.isPending}
          onCreate={onPaymentCreate}
        />
      )}
      {slots?.afterPayments}

      {slots?.creditNotesContent !== undefined ? (
        slots.creditNotesContent
      ) : (
        <InvoiceCreditNotesCard
          invoice={invoice}
          creditNotes={creditNotes}
          pending={creditNotesQuery.isPending}
          onCreate={onCreditNoteCreate}
        />
      )}
      {slots?.afterCreditNotes}

      {slots?.attachmentsContent !== undefined ? (
        slots.attachmentsContent
      ) : (
        <InvoiceAttachmentsCard
          invoice={invoice}
          attachments={attachments}
          pending={attachmentsQuery.isPending}
          deletePending={removeAttachment.isPending}
          getDownloadHref={
            getAttachmentDownloadHref ??
            ((attachment) => `/v1/finance/invoice-attachments/${attachment.id}/download`)
          }
          onCreate={() => {
            setEditingAttachment(undefined)
            setAttachmentOpen(true)
          }}
          onEdit={(attachment) => {
            setEditingAttachment(attachment)
            setAttachmentOpen(true)
          }}
          onDelete={async (attachmentId) => {
            await removeAttachment.mutateAsync(attachmentId)
          }}
        />
      )}
      {slots?.afterAttachments}

      {slots?.notesContent !== undefined ? (
        slots.notesContent
      ) : (
        <InvoiceNotesCard
          notes={notes}
          pending={notesQuery.isPending}
          addPending={addNote.isPending}
          onCreate={() => setNoteOpen(true)}
        />
      )}
      {slots?.afterNotes}

      <InvoiceDialog open={editOpen} onOpenChange={setEditOpen} invoice={invoice} />
      <InvoiceAttachmentDialog
        open={attachmentOpen}
        onOpenChange={setAttachmentOpen}
        invoiceId={id}
        attachment={editingAttachment}
        onSuccess={() => {
          setAttachmentOpen(false)
          setEditingAttachment(undefined)
          void attachmentsQuery.refetch()
        }}
      />
      {renderInvoiceNoteDialog ? (
        renderInvoiceNoteDialog({
          open: noteOpen,
          onOpenChange: setNoteOpen,
          pending: addNote.isPending,
          onSubmit: handleCreateNote,
        })
      ) : (
        <InvoiceNoteDialog
          open={noteOpen}
          onOpenChange={setNoteOpen}
          pending={addNote.isPending}
          onSubmit={handleCreateNote}
        />
      )}
      {slots?.dialogs}
    </div>
  )
}

export interface InvoiceDetailHeaderProps {
  invoice: InvoiceRecord
  onBack?: () => void
  onEdit: () => void
  onDelete: () => Promise<void>
  deletePending?: boolean
  className?: string
}

export function InvoiceDetailHeader({
  invoice,
  onBack,
  onEdit,
  onDelete,
  deletePending,
  className,
}: InvoiceDetailHeaderProps) {
  const messages = useFinanceUiMessagesOrDefault()
  const detail = messages.invoiceDetailPage
  const canDelete = invoice.status === "draft"
  const invoiceType = invoice.invoiceType ?? "invoice"

  return (
    <div
      data-slot="invoice-detail-header"
      className={cn("flex flex-col gap-4 md:flex-row md:items-start", className)}
    >
      {onBack ? (
        <Button type="button" variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          <span className="sr-only">{detail.actions.back}</span>
        </Button>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{detail.title}</h1>
          <Badge variant={invoiceStatusVariant[invoice.status] ?? "secondary"}>
            {messages.common.invoiceStatusLabels[invoice.status]}
          </Badge>
          <Badge variant="outline">{detail.invoiceTypeLabels[invoiceType]}</Badge>
        </div>
        <p className="mt-1 truncate font-mono text-muted-foreground text-sm">
          {invoice.invoiceNumber}
        </p>
        <p className="mt-1 text-muted-foreground text-xs">
          {detail.fields.booking}: {invoice.bookingId}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        <Button type="button" variant="outline" onClick={onEdit}>
          <Pencil className="size-4" aria-hidden="true" />
          {detail.actions.edit}
        </Button>
        <ConfirmActionButton
          buttonLabel={detail.actions.delete}
          confirmLabel={detail.actions.delete}
          cancelLabel={messages.common.cancel}
          title={detail.actions.deleteTitle}
          description={
            canDelete ? detail.actions.deleteDescription : detail.actions.deleteOnlyDraft
          }
          variant="destructive"
          confirmVariant="destructive"
          disabled={!canDelete || deletePending}
          onConfirm={onDelete}
        />
      </div>
    </div>
  )
}

export interface InvoiceDetailCardProps {
  invoice: InvoiceRecord
  className?: string
}

export function InvoiceSummaryCard({ invoice, className }: InvoiceDetailCardProps) {
  const { formatCurrency } = useFinanceUiI18nOrDefault()
  const messages = useFinanceUiMessagesOrDefault()
  const detail = messages.invoiceDetailPage

  return (
    <Card data-slot="invoice-summary-card" className={className}>
      <CardHeader>
        <CardTitle>{detail.titles.summary}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 text-sm">
          <DetailRow label={detail.fields.currency}>{invoice.currency}</DetailRow>
          <DetailRow label={detail.fields.subtotal}>
            <Money cents={invoice.subtotalCents} currency={invoice.currency} />
          </DetailRow>
          <DetailRow label={detail.fields.tax}>
            <Money cents={invoice.taxCents} currency={invoice.currency} />
          </DetailRow>
          <DetailRow label={detail.fields.total}>
            <span className="font-semibold">
              {formatCurrency(invoice.totalCents / 100, invoice.currency)}
            </span>
          </DetailRow>
          <DetailRow label={detail.fields.paid}>
            <Money cents={invoice.paidCents} currency={invoice.currency} />
          </DetailRow>
          <DetailRow label={detail.fields.balanceDue}>
            <span className="font-semibold">
              {formatCurrency(invoice.balanceDueCents / 100, invoice.currency)}
            </span>
          </DetailRow>
          <DetailRow label={detail.fields.status}>
            <Badge variant={invoiceStatusVariant[invoice.status] ?? "secondary"}>
              {messages.common.invoiceStatusLabels[invoice.status]}
            </Badge>
          </DetailRow>
        </dl>
      </CardContent>
    </Card>
  )
}

export interface InvoiceLinksCardProps extends InvoiceDetailCardProps {
  onBookingOpen?: (bookingId: string, invoice: InvoiceRecord) => void
  onPersonOpen?: (personId: string, invoice: InvoiceRecord) => void
  onOrganizationOpen?: (organizationId: string, invoice: InvoiceRecord) => void
}

export function InvoiceLinksCard({
  invoice,
  className,
  onBookingOpen,
  onPersonOpen,
  onOrganizationOpen,
}: InvoiceLinksCardProps) {
  const { formatDate, formatDateTime } = useFinanceUiI18nOrDefault()
  const messages = useFinanceUiMessagesOrDefault()
  const detail = messages.invoiceDetailPage

  return (
    <Card data-slot="invoice-links-card" className={className}>
      <CardHeader>
        <CardTitle>{detail.titles.links}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 text-sm">
          <DetailRow label={detail.fields.issueDate}>{formatDate(invoice.issueDate)}</DetailRow>
          <DetailRow label={detail.fields.dueDate}>{formatDate(invoice.dueDate)}</DetailRow>
          <DetailRow label={detail.fields.booking}>
            <DetailLink
              label={invoice.bookingId}
              actionLabel={detail.actions.viewBooking}
              onClick={() => onBookingOpen?.(invoice.bookingId, invoice)}
              disabled={!onBookingOpen}
            />
          </DetailRow>
          {invoice.personId ? (
            <DetailRow label={detail.fields.person}>
              <DetailLink
                label={invoice.personId}
                actionLabel={detail.actions.viewPerson}
                onClick={() => onPersonOpen?.(invoice.personId as string, invoice)}
                disabled={!onPersonOpen}
              />
            </DetailRow>
          ) : null}
          {invoice.organizationId ? (
            <DetailRow label={detail.fields.organization}>
              <DetailLink
                label={invoice.organizationId}
                actionLabel={detail.actions.viewOrganization}
                onClick={() => onOrganizationOpen?.(invoice.organizationId as string, invoice)}
                disabled={!onOrganizationOpen}
              />
            </DetailRow>
          ) : null}
          {invoice.notes ? (
            <div className="mt-2 flex flex-col gap-1">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                {detail.fields.notes}
              </dt>
              <dd className="whitespace-pre-wrap text-sm">{invoice.notes}</dd>
            </div>
          ) : null}
          <DetailRow label={detail.fields.createdAt}>{formatDateTime(invoice.createdAt)}</DetailRow>
          <DetailRow label={detail.fields.updatedAt}>{formatDateTime(invoice.updatedAt)}</DetailRow>
        </dl>
      </CardContent>
    </Card>
  )
}

export interface InvoiceLineItemsCardProps extends InvoiceDetailCardProps {
  lineItems: LineItemRecord[]
  pending?: boolean
  deletePending?: boolean
  onCreate?: (invoice: InvoiceRecord) => void
  onEdit?: (lineItem: LineItemRecord, invoice: InvoiceRecord) => void
  onDelete?: (lineItemId: string) => Promise<void>
}

export function InvoiceLineItemsCard({
  invoice,
  lineItems,
  pending,
  deletePending,
  onCreate,
  onEdit,
  onDelete,
  className,
}: InvoiceLineItemsCardProps) {
  const messages = useFinanceUiMessagesOrDefault()
  const detail = messages.invoiceDetailPage

  return (
    <InvoiceSection
      dataSlot="invoice-line-items-card"
      title={detail.titles.lineItems}
      className={className}
      action={
        onCreate ? (
          <Button size="sm" onClick={() => onCreate(invoice)}>
            <Plus className="size-4" aria-hidden="true" />
            {detail.actions.addLineItem}
          </Button>
        ) : null
      }
    >
      {pending ? (
        <LoadingRow />
      ) : lineItems.length === 0 ? (
        <EmptyRow>{detail.states.noLineItems}</EmptyRow>
      ) : (
        <div className="overflow-hidden rounded border bg-background">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="p-2 text-left font-medium">{detail.columns.description}</th>
                <th className="p-2 text-right font-medium">{detail.columns.quantity}</th>
                <th className="p-2 text-right font-medium">{detail.columns.unitPrice}</th>
                <th className="p-2 text-right font-medium">{detail.columns.total}</th>
                <th className="p-2 text-right font-medium">{detail.columns.taxRate}</th>
                <th className="w-20 p-2" />
              </tr>
            </thead>
            <tbody>
              {lineItems.map((lineItem) => (
                <tr key={lineItem.id} className="border-b last:border-b-0">
                  <td className="p-2">{lineItem.description}</td>
                  <td className="p-2 text-right">{lineItem.quantity}</td>
                  <td className="p-2 text-right">
                    <Money cents={lineItem.unitPriceCents} currency={invoice.currency} />
                  </td>
                  <td className="p-2 text-right">
                    <Money cents={lineItem.totalCents} currency={invoice.currency} />
                  </td>
                  <td className="p-2 text-right">
                    {lineItem.taxRate === null ? detail.states.noValue : `${lineItem.taxRate}%`}
                  </td>
                  <td className="p-2">
                    <div className="flex justify-end gap-1">
                      {onEdit ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => onEdit(lineItem, invoice)}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                          <span className="sr-only">{detail.actions.editLineItem}</span>
                        </Button>
                      ) : null}
                      {onDelete ? (
                        <ConfirmActionButton
                          buttonLabel={detail.actions.deleteLineItemShort}
                          confirmLabel={detail.actions.delete}
                          cancelLabel={messages.common.cancel}
                          title={detail.actions.deleteLineItemTitle}
                          description={detail.actions.deleteLineItemDescription}
                          disabled={deletePending}
                          variant="ghost"
                          confirmVariant="destructive"
                          onConfirm={() => onDelete(lineItem.id)}
                        />
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </InvoiceSection>
  )
}

export interface InvoicePaymentsCardProps extends InvoiceDetailCardProps {
  payments: PaymentRecord[]
  pending?: boolean
  onCreate?: (invoice: InvoiceRecord) => void
}

export function InvoicePaymentsCard({
  invoice,
  payments,
  pending,
  onCreate,
  className,
}: InvoicePaymentsCardProps) {
  const messages = useFinanceUiMessagesOrDefault()
  const detail = messages.invoiceDetailPage

  return (
    <InvoiceSection
      dataSlot="invoice-payments-card"
      title={detail.titles.payments}
      className={className}
      action={
        onCreate ? (
          <Button size="sm" onClick={() => onCreate(invoice)}>
            <Plus className="size-4" aria-hidden="true" />
            {detail.actions.recordPayment}
          </Button>
        ) : null
      }
    >
      {pending ? (
        <LoadingRow />
      ) : payments.length === 0 ? (
        <EmptyRow>{detail.states.noPayments}</EmptyRow>
      ) : (
        <ul className="divide-y">
          {payments.map((payment) => (
            <li key={payment.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {formatPaymentMethod(payment.paymentMethod, messages)}
                </p>
                <p className="text-xs text-muted-foreground">{payment.paymentDate}</p>
              </div>
              <div className="flex items-center gap-3">
                <Money cents={payment.amountCents} currency={payment.currency} />
                <Badge variant={paymentStatusVariant[payment.status] ?? "secondary"}>
                  {messages.common.supplierPaymentStatusLabels[payment.status]}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </InvoiceSection>
  )
}

export interface InvoiceCreditNotesCardProps extends InvoiceDetailCardProps {
  creditNotes: CreditNoteRecord[]
  pending?: boolean
  onCreate?: (invoice: InvoiceRecord) => void
}

export function InvoiceCreditNotesCard({
  invoice,
  creditNotes,
  pending,
  onCreate,
  className,
}: InvoiceCreditNotesCardProps) {
  const messages = useFinanceUiMessagesOrDefault()
  const detail = messages.invoiceDetailPage

  return (
    <InvoiceSection
      dataSlot="invoice-credit-notes-card"
      title={detail.titles.creditNotes}
      className={className}
      action={
        onCreate ? (
          <Button size="sm" onClick={() => onCreate(invoice)}>
            <Plus className="size-4" aria-hidden="true" />
            {detail.actions.addCreditNote}
          </Button>
        ) : null
      }
    >
      {pending ? (
        <LoadingRow />
      ) : creditNotes.length === 0 ? (
        <EmptyRow>{detail.states.noCreditNotes}</EmptyRow>
      ) : (
        <ul className="divide-y">
          {creditNotes.map((creditNote) => (
            <li key={creditNote.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{creditNote.creditNoteNumber}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{creditNote.reason}</p>
              </div>
              <div className="flex items-center gap-3">
                <Money cents={creditNote.amountCents} currency={creditNote.currency} />
                <Badge variant={creditNoteStatusVariant[creditNote.status] ?? "secondary"}>
                  {detail.creditNoteStatusLabels[creditNote.status]}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </InvoiceSection>
  )
}

export interface InvoiceAttachmentsCardProps extends InvoiceDetailCardProps {
  attachments: InvoiceAttachmentRecord[]
  pending?: boolean
  deletePending?: boolean
  getDownloadHref?: (attachment: InvoiceAttachmentRecord) => string | undefined
  onCreate: () => void
  onEdit: (attachment: InvoiceAttachmentRecord) => void
  onDelete: (attachmentId: string) => Promise<void> // i18n-literal-ok function type
}

export function InvoiceAttachmentsCard({
  attachments,
  pending,
  deletePending,
  getDownloadHref,
  onCreate,
  onEdit,
  onDelete,
  className,
}: InvoiceAttachmentsCardProps) {
  const messages = useFinanceUiMessagesOrDefault()
  const detail = messages.invoiceDetailPage

  return (
    <InvoiceSection
      dataSlot="invoice-attachments-card"
      title={detail.titles.attachments}
      className={className}
      action={
        <Button size="sm" onClick={onCreate}>
          <Plus className="size-4" aria-hidden="true" />
          {detail.actions.addAttachment}
        </Button>
      }
    >
      {pending ? (
        <LoadingRow />
      ) : attachments.length === 0 ? (
        <EmptyRow>{detail.states.noAttachments}</EmptyRow>
      ) : (
        <div className="overflow-hidden rounded border bg-background">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="p-2 text-left font-medium">{detail.columns.name}</th>
                <th className="p-2 text-left font-medium">{detail.columns.kind}</th>
                <th className="p-2 text-left font-medium">{detail.columns.mimeType}</th>
                <th className="p-2 text-right font-medium">{detail.columns.size}</th>
                <th className="w-20 p-2" />
              </tr>
            </thead>
            <tbody>
              {attachments.map((attachment) => {
                const downloadHref = getDownloadHref?.(attachment)
                return (
                  <tr key={attachment.id} className="border-b last:border-b-0">
                    <td className="min-w-0 p-2">
                      {downloadHref ? (
                        <a
                          href={downloadHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex max-w-full items-center gap-1.5 hover:underline"
                        >
                          <FileText className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
                          <span className="truncate">{attachment.name}</span>
                          <ExternalLink className="size-3 shrink-0 opacity-60" aria-hidden="true" />
                        </a>
                      ) : (
                        <span className="truncate">{attachment.name}</span>
                      )}
                    </td>
                    <td className="p-2">{attachment.kind}</td>
                    <td className="p-2">{attachment.mimeType ?? detail.states.noValue}</td>
                    <td className="p-2 text-right">
                      {attachment.fileSize == null
                        ? detail.states.noValue
                        : formatBytes(attachment.fileSize)}
                    </td>
                    <td className="p-2">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => onEdit(attachment)}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                          <span className="sr-only">{detail.actions.editAttachment}</span>
                        </Button>
                        <ConfirmActionButton
                          buttonLabel={detail.actions.deleteAttachmentShort}
                          confirmLabel={detail.actions.delete}
                          cancelLabel={messages.common.cancel}
                          title={detail.actions.deleteAttachmentTitle}
                          description={detail.actions.deleteAttachmentDescription}
                          disabled={deletePending}
                          variant="ghost"
                          confirmVariant="destructive"
                          onConfirm={() => onDelete(attachment.id)}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </InvoiceSection>
  )
}

export interface InvoiceNotesCardProps {
  notes: FinanceNoteRecord[]
  noteContent?: string
  pending?: boolean
  addPending?: boolean
  className?: string
  onNoteChange?: (value: string) => void
  onAddNote?: () => Promise<void>
  onCreate?: () => void
}

export function InvoiceNotesCard({
  notes,
  noteContent,
  pending,
  addPending,
  className,
  onNoteChange,
  onAddNote,
  onCreate,
}: InvoiceNotesCardProps) {
  const messages = useFinanceUiMessagesOrDefault()
  const detail = messages.invoiceDetailPage
  const controlledNoteContent = noteContent ?? ""

  return (
    <InvoiceSection
      dataSlot="invoice-notes-card"
      title={detail.titles.notes}
      className={className}
      action={
        onCreate ? (
          <Button size="sm" onClick={onCreate} disabled={addPending}>
            {addPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            <Plus className="size-4" aria-hidden="true" />
            {detail.actions.addNote}
          </Button>
        ) : null
      }
    >
      {pending ? (
        <LoadingRow />
      ) : notes.length === 0 ? (
        <EmptyRow>{detail.states.noNotes}</EmptyRow>
      ) : (
        <ul className="divide-y">
          {notes.map((note) => (
            <li key={note.id} className="py-3">
              <p className="whitespace-pre-wrap text-sm">{note.content}</p>
              <p className="mt-1 text-xs text-muted-foreground">{note.createdAt}</p>
            </li>
          ))}
        </ul>
      )}
      {!onCreate && onNoteChange && onAddNote ? (
        <div className="mt-4 flex flex-col gap-2">
          <Textarea
            value={controlledNoteContent}
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder={detail.placeholders.note}
            rows={3}
          />
          <Button
            type="button"
            className="self-end"
            disabled={addPending || controlledNoteContent.trim().length === 0}
            onClick={() => void onAddNote()}
          >
            {addPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {detail.actions.addNote}
          </Button>
        </div>
      ) : null}
    </InvoiceSection>
  )
}

function createInvoiceNoteFormSchema(messages: ReturnType<typeof useFinanceUiMessagesOrDefault>) {
  return z.object({
    content: z.string().trim().min(1, messages.invoiceDetailPage.noteDialog.contentRequired),
  })
}

type InvoiceNoteFormSchema = ReturnType<typeof createInvoiceNoteFormSchema>
type InvoiceNoteFormValues = z.input<InvoiceNoteFormSchema>
type InvoiceNoteFormOutput = z.output<InvoiceNoteFormSchema>

export interface InvoiceNoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pending?: boolean
  onSubmit: (content: string) => Promise<void>
}

export function InvoiceNoteDialog({
  open,
  onOpenChange,
  pending,
  onSubmit,
}: InvoiceNoteDialogProps) {
  const messages = useFinanceUiMessagesOrDefault()
  const detail = messages.invoiceDetailPage
  const noteFormSchema = createInvoiceNoteFormSchema(messages)

  const form = useForm<InvoiceNoteFormValues, unknown, InvoiceNoteFormOutput>({
    resolver: zodResolver(noteFormSchema),
    defaultValues: {
      content: "",
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({ content: "" })
    }
  }, [form, open])

  const handleSubmit = async (values: InvoiceNoteFormOutput) => {
    await onSubmit(values.content)
    form.reset({ content: "" })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{detail.noteDialog.title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>{detail.fields.notes}</Label>
              <Textarea
                {...form.register("content")}
                placeholder={detail.placeholders.note}
                rows={4}
              />
              {form.formState.errors.content ? (
                <p className="text-xs text-destructive">{form.formState.errors.content.message}</p>
              ) : null}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={pending || form.formState.isSubmitting}>
              {pending || form.formState.isSubmitting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {detail.noteDialog.createAction}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function createInvoiceAttachmentFormSchema(
  messages: ReturnType<typeof useFinanceUiMessagesOrDefault>,
) {
  return z.object({
    name: z.string().min(1, messages.invoiceDetailPage.attachmentDialog.nameRequired),
    kind: z.string().min(1).optional(),
    mimeType: z.string().optional(),
    fileSize: z.coerce.number().int().min(0).optional(),
    storageKey: z.string().optional(),
    checksum: z.string().optional(),
  })
}

type InvoiceAttachmentFormSchema = ReturnType<typeof createInvoiceAttachmentFormSchema>
type InvoiceAttachmentFormValues = z.input<InvoiceAttachmentFormSchema>
type InvoiceAttachmentFormOutput = z.output<InvoiceAttachmentFormSchema>

interface InvoiceAttachmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceId: string
  attachment?: InvoiceAttachmentRecord
  onSuccess: () => void
}

function InvoiceAttachmentDialog({
  open,
  onOpenChange,
  invoiceId,
  attachment,
  onSuccess,
}: InvoiceAttachmentDialogProps) {
  const isEditing = Boolean(attachment)
  const messages = useFinanceUiMessagesOrDefault()
  const detail = messages.invoiceDetailPage
  const attachmentFormSchema = createInvoiceAttachmentFormSchema(messages)
  const { create, update } = useInvoiceAttachmentMutation(invoiceId)

  const form = useForm<InvoiceAttachmentFormValues, unknown, InvoiceAttachmentFormOutput>({
    resolver: zodResolver(attachmentFormSchema),
    defaultValues: {
      name: "",
      kind: "supporting_document",
      mimeType: "",
      fileSize: undefined,
      storageKey: "",
      checksum: "",
    },
  })

  useEffect(() => {
    if (open && attachment) {
      form.reset({
        name: attachment.name,
        kind: attachment.kind,
        mimeType: attachment.mimeType ?? "",
        fileSize: attachment.fileSize ?? undefined,
        storageKey: attachment.storageKey ?? "",
        checksum: attachment.checksum ?? "",
      })
    } else if (open) {
      form.reset()
    }
  }, [open, attachment, form])

  const onSubmit = async (values: InvoiceAttachmentFormOutput) => {
    const payload = {
      name: values.name,
      kind: values.kind || "supporting_document",
      mimeType: values.mimeType || undefined,
      fileSize: values.fileSize || undefined,
      storageKey: values.storageKey || undefined,
      checksum: values.checksum || undefined,
    }

    if (isEditing && attachment) {
      await update.mutateAsync({ id: attachment.id, input: payload })
    } else {
      await create.mutateAsync(payload)
    }
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? detail.attachmentDialog.editTitle : detail.attachmentDialog.createTitle}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>{detail.fields.name}</Label>
              <Input {...form.register("name")} placeholder={detail.placeholders.attachmentName} />
              {form.formState.errors.name ? (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>{detail.fields.kind}</Label>
                <Input
                  {...form.register("kind")}
                  placeholder={detail.placeholders.attachmentKind}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{detail.fields.mimeType}</Label>
                <Input
                  {...form.register("mimeType")}
                  placeholder={detail.placeholders.attachmentMimeType}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>{detail.fields.fileSize}</Label>
                <Input
                  {...form.register("fileSize")}
                  type="number"
                  placeholder={detail.placeholders.attachmentFileSize}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{detail.fields.checksum}</Label>
                <Input
                  {...form.register("checksum")}
                  placeholder={detail.placeholders.attachmentChecksum}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{detail.fields.storageKey}</Label>
              <Input
                {...form.register("storageKey")}
                placeholder={detail.placeholders.attachmentStorageKey}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {isEditing ? messages.common.saveChanges : detail.attachmentDialog.createAction}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export interface MoneyProps {
  cents: number
  currency: string
}

export interface InvoiceSectionProps {
  dataSlot: string
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
}

export function InvoiceSection({
  dataSlot,
  title,
  action,
  children,
  className,
}: InvoiceSectionProps) {
  return (
    <section data-slot={dataSlot} className={cn("rounded-md border bg-background", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <h2 className="font-semibold text-sm">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

export function Money({ cents, currency }: MoneyProps) {
  const { formatCurrency } = useFinanceUiI18nOrDefault()

  return <span className="font-mono">{formatCurrency(cents / 100, currency)}</span>
}

export interface DetailRowProps {
  label: string
  children: ReactNode
}

export function DetailRow({ label, children }: DetailRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  )
}

export interface DetailLinkProps {
  label: string
  actionLabel: string
  onClick: () => void
  disabled?: boolean
}

export function DetailLink({ label, actionLabel, onClick, disabled }: DetailLinkProps) {
  if (disabled) return label

  return (
    <Button type="button" variant="link" className="h-auto p-0" onClick={onClick}>
      {label}
      <ExternalLink className="ml-1 size-3" aria-label={actionLabel} />
    </Button>
  )
}

export interface EmptyRowProps {
  children: ReactNode
}

export function EmptyRow({ children }: EmptyRowProps) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>
}

export function LoadingRow() {
  return (
    <div className="flex justify-center py-6">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  )
}

export function InvoiceDetailLoading({ className }: { className?: string }) {
  const messages = useFinanceUiMessagesOrDefault()

  return (
    <div className={cn("flex min-h-48 items-center justify-center", className)}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        {messages.invoiceDetailPage.states.loading}
      </div>
    </div>
  )
}

export function InvoiceDetailState({
  className,
  message,
  onBack,
}: {
  className?: string
  message: string
  onBack?: () => void
}) {
  const messages = useFinanceUiMessagesOrDefault()

  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 py-12", className)}>
      <p className="text-muted-foreground">{message}</p>
      {onBack ? (
        <Button type="button" variant="outline" onClick={onBack}>
          {messages.invoiceDetailPage.actions.back}
        </Button>
      ) : null}
    </div>
  )
}

export function formatPaymentMethod(
  method: string,
  messages: ReturnType<typeof useFinanceUiMessagesOrDefault>,
) {
  if (method in messages.common.paymentMethodLabels) {
    return messages.common.paymentMethodLabels[
      method as keyof typeof messages.common.paymentMethodLabels
    ]
  }

  if (method in messages.common.supplierPaymentMethodLabels) {
    return messages.common.supplierPaymentMethodLabels[
      method as keyof typeof messages.common.supplierPaymentMethodLabels
    ]
  }

  return method.replace(/_/g, " ")
}

export const invoiceStatusVariant: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  draft: "outline",
  sent: "secondary",
  partially_paid: "secondary",
  paid: "default",
  overdue: "destructive",
  void: "secondary",
}

export const paymentStatusVariant: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  pending: "outline",
  completed: "default",
  failed: "destructive",
  refunded: "secondary",
}

export const creditNoteStatusVariant: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  draft: "outline",
  issued: "secondary",
  applied: "default",
}
