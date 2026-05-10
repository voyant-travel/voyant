"use client"

import type {
  CreditNoteRecord,
  FinanceNoteRecord,
  InvoiceRecord,
  LineItemRecord,
  PaymentRecord,
} from "@voyantjs/finance-react"
import {
  useInvoice,
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
  Textarea,
} from "@voyantjs/ui/components"
import { cn } from "@voyantjs/ui/lib/utils"
import { ArrowLeft, ExternalLink, Loader2, Pencil, Plus } from "lucide-react"
import { type ReactNode, useState } from "react"

import { useFinanceUiI18nOrDefault, useFinanceUiMessagesOrDefault } from "../i18n/index.js"
import { InvoiceDialog } from "./invoice-dialog.js"

export interface InvoiceDetailPageSlots {
  afterHeader?: ReactNode
  afterSummary?: ReactNode
  afterLineItems?: ReactNode
  afterPayments?: ReactNode
  afterCreditNotes?: ReactNode
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
  slots,
}: InvoiceDetailPageProps) {
  const messages = useFinanceUiMessagesOrDefault()
  const [editOpen, setEditOpen] = useState(false)
  const [noteContent, setNoteContent] = useState("")

  const invoiceQuery = useInvoice(id)
  const invoice = invoiceQuery.data?.data
  const lineItemsQuery = useInvoiceLineItems(id, { enabled: Boolean(invoice) })
  const paymentsQuery = useInvoicePayments(id, { enabled: Boolean(invoice) })
  const creditNotesQuery = useInvoiceCreditNotes(id, { enabled: Boolean(invoice) })
  const notesQuery = useInvoiceNotes(id, { enabled: Boolean(invoice) })
  const { remove: removeInvoice } = useInvoiceMutation()
  const { remove: removeLineItem } = useInvoiceLineItemMutation(id)
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
  const notes = notesQuery.data?.data ?? []

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
      {slots?.afterLineItems}

      <InvoicePaymentsCard
        invoice={invoice}
        payments={payments}
        pending={paymentsQuery.isPending}
        onCreate={onPaymentCreate}
      />
      {slots?.afterPayments}

      <InvoiceCreditNotesCard
        invoice={invoice}
        creditNotes={creditNotes}
        pending={creditNotesQuery.isPending}
        onCreate={onCreditNoteCreate}
      />
      {slots?.afterCreditNotes}

      <InvoiceNotesCard
        notes={notes}
        noteContent={noteContent}
        pending={notesQuery.isPending}
        addPending={addNote.isPending}
        onNoteChange={setNoteContent}
        onAddNote={async () => {
          const content = noteContent.trim()
          if (!content) return
          await addNote.mutateAsync({ content })
          setNoteContent("")
        }}
      />
      {slots?.afterNotes}

      <InvoiceDialog open={editOpen} onOpenChange={setEditOpen} invoice={invoice} />
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
          <h1 className="truncate text-2xl font-bold tracking-tight">{invoice.invoiceNumber}</h1>
          <Badge variant="outline">{invoice.invoiceType ?? "invoice"}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{invoice.bookingId}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        <Badge variant={invoiceStatusVariant[invoice.status] ?? "secondary"}>
          {messages.common.invoiceStatusLabels[invoice.status]}
        </Badge>
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
    <Card data-slot="invoice-line-items-card" className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{detail.titles.lineItems}</CardTitle>
        {onCreate ? (
          <Button size="sm" onClick={() => onCreate(invoice)}>
            <Plus className="size-4" aria-hidden="true" />
            {detail.actions.addLineItem}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
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
    <Card data-slot="invoice-payments-card" className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{detail.titles.payments}</CardTitle>
        {onCreate ? (
          <Button size="sm" onClick={() => onCreate(invoice)}>
            <Plus className="size-4" aria-hidden="true" />
            {detail.actions.recordPayment}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
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
    <Card data-slot="invoice-credit-notes-card" className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{detail.titles.creditNotes}</CardTitle>
        {onCreate ? (
          <Button size="sm" onClick={() => onCreate(invoice)}>
            <Plus className="size-4" aria-hidden="true" />
            {detail.actions.addCreditNote}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  )
}

export interface InvoiceNotesCardProps {
  notes: FinanceNoteRecord[]
  noteContent: string
  pending?: boolean
  addPending?: boolean
  className?: string
  onNoteChange: (value: string) => void
  onAddNote: () => Promise<void>
}

export function InvoiceNotesCard({
  notes,
  noteContent,
  pending,
  addPending,
  className,
  onNoteChange,
  onAddNote,
}: InvoiceNotesCardProps) {
  const messages = useFinanceUiMessagesOrDefault()
  const detail = messages.invoiceDetailPage

  return (
    <Card data-slot="invoice-notes-card" className={className}>
      <CardHeader>
        <CardTitle>{detail.titles.notes}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
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
        <div className="flex flex-col gap-2">
          <Textarea
            value={noteContent}
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder={detail.placeholders.note}
            rows={3}
          />
          <Button
            type="button"
            className="self-end"
            disabled={addPending || noteContent.trim().length === 0}
            onClick={() => void onAddNote()}
          >
            {addPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {detail.actions.addNote}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export interface MoneyProps {
  cents: number
  currency: string
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
