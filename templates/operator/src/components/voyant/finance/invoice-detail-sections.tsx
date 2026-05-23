import { useLocale } from "@voyantjs/admin"
import { useInvoiceAttachments } from "@voyantjs/finance-react"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Textarea,
} from "@voyantjs/ui/components"
import { Download, FileText, Pencil, Plus, Trash2 } from "lucide-react"
import { type AdminMessages, useAdminMessages } from "@/lib/admin-i18n"
import { getApiUrl } from "@/lib/env"

import {
  type CreditNoteRow,
  creditNoteStatusVariant,
  type FinanceNote,
  formatAmount,
  formatMethod,
  type InvoiceDetail,
  type LineItem,
  type PaymentRow,
  paymentStatusVariant,
} from "./invoice-detail-shared"

function getPaymentStatusLabel(messages: AdminMessages, status: string): string {
  switch (status) {
    case "pending":
      return messages.finance.paymentStatusPending
    case "completed":
      return messages.finance.paymentStatusCompleted
    case "failed":
      return messages.finance.paymentStatusFailed
    case "refunded":
      return messages.finance.paymentStatusRefunded
    default:
      return status.replace(/_/g, " ")
  }
}

function getPaymentMethodLabel(messages: AdminMessages, method: string): string {
  switch (method) {
    case "bank_transfer":
      return messages.finance.paymentMethodBankTransfer
    case "credit_card":
      return messages.finance.paymentMethodCreditCard
    case "cash":
      return messages.finance.paymentMethodCash
    case "cheque":
      return messages.finance.paymentMethodCheque
    case "other":
      return messages.finance.paymentMethodOther
    default:
      return formatMethod(method)
  }
}

function getCreditNoteStatusLabel(messages: AdminMessages, status: string): string {
  switch (status) {
    case "draft":
      return messages.finance.creditNoteStatusDraft
    case "issued":
      return messages.finance.creditNoteStatusIssued
    case "applied":
      return messages.finance.creditNoteStatusApplied
    default:
      return status.replace(/_/g, " ")
  }
}

export function InvoiceInfoCards({
  invoice,
  onOpenBooking,
}: {
  invoice: InvoiceDetail
  onOpenBooking: () => void
}) {
  const messages = useAdminMessages()
  const { resolvedLocale } = useLocale()

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{messages.finance.detailSections.invoiceDetailsTitle}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">
              {messages.finance.detailSections.currencyLabel}:
            </span>{" "}
            <span>{invoice.currency}</span>
          </div>
          <div>
            <span className="text-muted-foreground">
              {messages.finance.detailSections.subtotalLabel}:
            </span>{" "}
            <span className="font-mono">
              {formatAmount(invoice.subtotalCents, invoice.currency)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">
              {messages.finance.detailSections.taxLabel}:
            </span>{" "}
            <span className="font-mono">{formatAmount(invoice.taxCents, invoice.currency)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">
              {messages.finance.detailSections.totalLabel}:
            </span>{" "}
            <span className="font-mono font-semibold">
              {formatAmount(invoice.totalCents, invoice.currency)}
            </span>
          </div>
          <div className="mt-2 border-t pt-3">
            <span className="text-muted-foreground">
              {messages.finance.detailSections.paidLabel}:
            </span>{" "}
            <span className="font-mono">{formatAmount(invoice.paidCents, invoice.currency)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">
              {messages.finance.detailSections.balanceDueLabel}:
            </span>{" "}
            <span className="font-mono font-semibold">
              {formatAmount(invoice.balanceDueCents, invoice.currency)}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{messages.finance.detailSections.datesLinksTitle}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">
              {messages.finance.detailSections.issueDateLabel}:
            </span>{" "}
            <span>{invoice.issueDate}</span>
          </div>
          <div>
            <span className="text-muted-foreground">
              {messages.finance.detailSections.dueDateLabel}:
            </span>{" "}
            <span>{invoice.dueDate}</span>
          </div>
          <div>
            <span className="text-muted-foreground">
              {messages.finance.detailSections.bookingLabel}:
            </span>{" "}
            <button type="button" className="text-primary underline" onClick={onOpenBooking}>
              {messages.finance.detailSections.viewBooking}
            </button>
          </div>
          {invoice.personId ? (
            <div>
              <span className="text-muted-foreground">
                {messages.finance.detailSections.personLabel}:
              </span>{" "}
              <span className="font-mono text-xs">{invoice.personId}</span>
            </div>
          ) : null}
          {invoice.organizationId ? (
            <div>
              <span className="text-muted-foreground">
                {messages.finance.detailSections.organizationLabel}:
              </span>{" "}
              <span className="font-mono text-xs">{invoice.organizationId}</span>
            </div>
          ) : null}
          {invoice.notes ? (
            <div className="mt-2 border-t pt-3">
              <span className="text-muted-foreground">
                {messages.finance.detailSections.notesLabel}:
              </span>
              <p className="mt-1 whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          ) : null}
          <div className="mt-2 border-t pt-3">
            <div>
              <span className="text-muted-foreground">
                {messages.finance.detailSections.createdLabel}:
              </span>{" "}
              <span>{new Date(invoice.createdAt).toLocaleDateString(resolvedLocale)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">
                {messages.finance.detailSections.updatedLabel}:
              </span>{" "}
              <span>{new Date(invoice.updatedAt).toLocaleDateString(resolvedLocale)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function InvoiceLineItemsCard({
  lineItems,
  onCreate,
  onEdit,
  onDelete,
}: {
  lineItems: LineItem[]
  onCreate: () => void
  onEdit: (lineItem: LineItem) => void
  onDelete: (lineId: string) => void
}) {
  const messages = useAdminMessages()
  const noValue = messages.finance.detailSections.noValue

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{messages.finance.detailSections.lineItemsTitle}</CardTitle>
        <Button size="sm" onClick={onCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {messages.finance.detailSections.addLineItem}
        </Button>
      </CardHeader>
      <CardContent>
        {lineItems.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {messages.finance.detailSections.noLineItems}
          </p>
        ) : (
          <div className="rounded border bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="p-2 text-left font-medium">
                    {messages.finance.detailSections.descriptionColumn}
                  </th>
                  <th className="p-2 text-right font-medium">
                    {messages.finance.detailSections.quantityColumn}
                  </th>
                  <th className="p-2 text-right font-medium">
                    {messages.finance.detailSections.unitPriceColumn}
                  </th>
                  <th className="p-2 text-right font-medium">{messages.finance.totalColumn}</th>
                  <th className="p-2 text-right font-medium">
                    {messages.finance.detailSections.taxRateColumn}
                  </th>
                  <th className="w-20 p-2" />
                </tr>
              </thead>
              <tbody>
                {lineItems.map((lineItem) => (
                  <tr key={lineItem.id} className="border-b last:border-b-0">
                    <td className="p-2">{lineItem.description}</td>
                    <td className="p-2 text-right">{lineItem.quantity}</td>
                    <td className="p-2 text-right font-mono">
                      {(lineItem.unitPriceCents / 100).toFixed(2)}
                    </td>
                    <td className="p-2 text-right font-mono">
                      {(lineItem.totalCents / 100).toFixed(2)}
                    </td>
                    <td className="p-2 text-right">
                      {lineItem.taxRate != null
                        ? `${(lineItem.taxRate / 100).toFixed(2)}%`
                        : noValue}
                    </td>
                    <td className="p-2">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onEdit(lineItem)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(lineItem.id)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
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

export function InvoicePaymentsCard({
  payments,
  onCreate,
}: {
  payments: PaymentRow[]
  onCreate: () => void
}) {
  const messages = useAdminMessages()
  const noValue = messages.finance.detailSections.noValue

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{messages.finance.detailSections.paymentsTitle}</CardTitle>
        <Button size="sm" onClick={onCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {messages.finance.detailSections.recordPayment}
        </Button>
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {messages.finance.detailSections.noPayments}
          </p>
        ) : (
          <div className="rounded border bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="p-2 text-left font-medium">{messages.finance.dateColumn}</th>
                  <th className="p-2 text-left font-medium">
                    {messages.finance.detailSections.methodColumn}
                  </th>
                  <th className="p-2 text-right font-medium">{messages.finance.amountColumn}</th>
                  <th className="p-2 text-left font-medium">{messages.finance.statusColumn}</th>
                  <th className="p-2 text-left font-medium">{messages.finance.referenceColumn}</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-b last:border-b-0">
                    <td className="p-2">{payment.paymentDate}</td>
                    <td className="p-2 capitalize">
                      {getPaymentMethodLabel(messages, payment.paymentMethod)}
                    </td>
                    <td className="p-2 text-right font-mono">
                      <div>{formatAmount(payment.amountCents, payment.currency)}</div>
                      {payment.baseAmountCents !== null && payment.baseCurrency ? (
                        <div className="text-muted-foreground text-xs">
                          {formatAmount(payment.baseAmountCents, payment.baseCurrency)}
                        </div>
                      ) : null}
                    </td>
                    <td className="p-2">
                      <Badge
                        variant={paymentStatusVariant[payment.status] ?? "secondary"}
                        className="text-xs capitalize"
                      >
                        {getPaymentStatusLabel(messages, payment.status)}
                      </Badge>
                    </td>
                    <td className="p-2">{payment.referenceNumber ?? noValue}</td>
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

export function InvoiceCreditNotesCard({
  creditNotes,
  onCreate,
}: {
  creditNotes: CreditNoteRow[]
  onCreate: () => void
}) {
  const messages = useAdminMessages()

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{messages.finance.detailSections.creditNotesTitle}</CardTitle>
        <Button size="sm" onClick={onCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {messages.finance.detailSections.addCreditNote}
        </Button>
      </CardHeader>
      <CardContent>
        {creditNotes.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {messages.finance.detailSections.noCreditNotes}
          </p>
        ) : (
          <div className="rounded border bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="p-2 text-left font-medium">
                    {messages.finance.detailSections.creditNoteNumberColumn}
                  </th>
                  <th className="p-2 text-right font-medium">{messages.finance.amountColumn}</th>
                  <th className="p-2 text-left font-medium">
                    {messages.finance.detailSections.reasonColumn}
                  </th>
                  <th className="p-2 text-left font-medium">{messages.finance.statusColumn}</th>
                </tr>
              </thead>
              <tbody>
                {creditNotes.map((creditNote) => (
                  <tr key={creditNote.id} className="border-b last:border-b-0">
                    <td className="p-2">{creditNote.creditNoteNumber}</td>
                    <td className="p-2 text-right font-mono">
                      {formatAmount(creditNote.amountCents, creditNote.currency)}
                    </td>
                    <td className="p-2">{creditNote.reason}</td>
                    <td className="p-2">
                      <Badge
                        variant={creditNoteStatusVariant[creditNote.status] ?? "secondary"}
                        className="text-xs capitalize"
                      >
                        {getCreditNoteStatusLabel(messages, creditNote.status)}
                      </Badge>
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

export function InvoiceAttachmentsCard({ invoiceId }: { invoiceId: string }) {
  const messages = useAdminMessages().finance.detailSections
  const { resolvedLocale } = useLocale()
  const { data } = useInvoiceAttachments(invoiceId)
  const attachments = data?.data ?? []
  const apiBase = getApiUrl()

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-muted-foreground" />
          {messages.attachmentsTitle}
          {attachments.length > 0 ? (
            <Badge variant="outline" className="text-[10px]">
              {attachments.length}
            </Badge>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {attachments.length === 0 ? (
          <p className="px-6 py-6 text-center text-muted-foreground text-sm">
            {messages.noAttachments}
          </p>
        ) : (
          <ul className="divide-y">
            {attachments.map((attachment) => (
              <li key={attachment.id} className="flex items-center justify-between gap-3 px-6 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{attachment.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {formatAttachmentMeta(attachment, resolvedLocale)}
                  </p>
                </div>
                <a
                  href={`${apiBase}/v1/admin/finance/invoice-attachments/${attachment.id}/download`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label={messages.downloadAttachment}
                >
                  <Download className="h-3.5 w-3.5" />
                  {messages.downloadAttachment}
                </a>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function formatAttachmentMeta(
  attachment: { fileSize?: number | null; mimeType?: string | null; createdAt?: string },
  locale: string,
): string {
  const parts: string[] = []
  if (attachment.mimeType) parts.push(attachment.mimeType)
  if (typeof attachment.fileSize === "number") parts.push(formatBytes(attachment.fileSize))
  if (attachment.createdAt) {
    try {
      parts.push(new Date(attachment.createdAt).toLocaleDateString(locale))
    } catch {
      // ignore — locale parse failures fall through silently
    }
  }
  return parts.join(" · ")
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function InvoiceNotesCard({
  notes,
  noteContent,
  isAdding,
  onNoteChange,
  onAddNote,
}: {
  notes: FinanceNote[]
  noteContent: string
  isAdding: boolean
  onNoteChange: (value: string) => void
  onAddNote: () => void
}) {
  const messages = useAdminMessages()
  const { resolvedLocale } = useLocale()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{messages.finance.detailSections.notesTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Textarea
            value={noteContent}
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder={messages.finance.detailSections.addInternalNotePlaceholder}
          />
          <div className="flex justify-end">
            <Button disabled={isAdding || !noteContent.trim()} onClick={onAddNote}>
              {messages.finance.detailSections.addNote}
            </Button>
          </div>
        </div>
        {notes.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {messages.finance.detailSections.noNotes}
          </p>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div key={note.id} className="rounded border p-3">
                <p className="whitespace-pre-wrap text-sm">{note.content}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(note.createdAt).toLocaleString(resolvedLocale)}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
