import { useNavigate } from "@tanstack/react-router"
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
import { InvoiceActionLedgerCard } from "@voyantjs/finance-ui/components/invoice-action-ledger-card"
import { InvoiceDialog } from "@voyantjs/finance-ui/components/invoice-dialog"
import { Badge, Button } from "@voyantjs/ui/components"
import { ArrowLeft, Pencil, Trash2 } from "lucide-react"
import { useState } from "react"
import { AdminWidgetSlotRenderer } from "@/components/admin/admin-widget-slot"
import { type AdminMessages, useAdminMessages } from "@/lib/admin-i18n"
import { CreditNoteDialog } from "./credit-note-dialog"
import {
  InvoiceAttachmentsCard,
  InvoiceCreditNotesCard,
  InvoiceInfoCards,
  InvoiceLineItemsCard,
  InvoiceNotesCard,
  InvoicePaymentsCard,
} from "./invoice-detail-sections"
import { type LineItem, statusVariant } from "./invoice-detail-shared"
import { InvoiceDetailSkeleton } from "./invoice-detail-skeleton"
import { LineItemDialog } from "./line-item-dialog"
import { PaymentDialog } from "./payment-dialog"

function getInvoiceStatusLabel(messages: AdminMessages, status: string): string {
  switch (status) {
    case "draft":
      return messages.finance.invoiceStatusDraft
    case "sent":
      return messages.finance.invoiceStatusSent
    case "partially_paid":
      return messages.finance.invoiceStatusPartiallyPaid
    case "paid":
      return messages.finance.invoiceStatusPaid
    case "overdue":
      return messages.finance.invoiceStatusOverdue
    case "void":
      return messages.finance.invoiceStatusVoid
    default:
      return status.replace(/_/g, " ")
  }
}

export function InvoiceDetailPage({ id }: { id: string }) {
  const messages = useAdminMessages()
  const navigate = useNavigate()
  const [editOpen, setEditOpen] = useState(false)
  const [lineItemDialogOpen, setLineItemDialogOpen] = useState(false)
  const [editingLineItem, setEditingLineItem] = useState<LineItem | undefined>()
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [creditNoteDialogOpen, setCreditNoteDialogOpen] = useState(false)
  const [noteContent, setNoteContent] = useState("")

  const { data: invoiceData, isPending } = useInvoice(id)
  const { data: lineItemsData } = useInvoiceLineItems(id)
  const { data: paymentsData } = useInvoicePayments(id)
  const { data: creditNotesData } = useInvoiceCreditNotes(id)
  const { data: notesData } = useInvoiceNotes(id)
  const { remove: deleteInvoice } = useInvoiceMutation()
  const { remove: deleteLineItem } = useInvoiceLineItemMutation(id)
  const addNoteMutation = useInvoiceNoteMutation(id)

  if (isPending) {
    return <InvoiceDetailSkeleton />
  }

  const invoice = invoiceData?.data
  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">{messages.finance.detailPage.notFound}</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/finance" })}>
          {messages.finance.detailPage.backToFinance}
        </Button>
      </div>
    )
  }

  const lineItems = lineItemsData?.data ?? []
  const payments = paymentsData?.data ?? []
  const creditNotes = creditNotesData?.data ?? []
  const notes = notesData?.data ?? []

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => void navigate({ to: "/finance" })}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{invoice.invoiceNumber}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant={statusVariant[invoice.status] ?? "secondary"} className="capitalize">
              {getInvoiceStatusLabel(messages, invoice.status)}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            {messages.finance.detailPage.edit}
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (invoice.status !== "draft") {
                alert(messages.finance.detailPage.deleteOnlyDraftAlert)
                return
              }
              if (confirm(messages.finance.detailPage.deleteConfirm)) {
                deleteInvoice.mutate(id, {
                  onSuccess: () => {
                    void navigate({ to: "/finance" })
                  },
                })
              }
            }}
            disabled={deleteInvoice.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {messages.finance.detailPage.delete}
          </Button>
        </div>
      </div>
      <AdminWidgetSlotRenderer slot="invoice.details.header" props={{ invoice }} />

      <InvoiceInfoCards
        invoice={invoice}
        onOpenBooking={() =>
          void navigate({
            to: "/bookings/$id",
            params: { id: invoice.bookingId },
          })
        }
      />
      <AdminWidgetSlotRenderer
        slot="invoice.details.after-summary"
        props={{ invoice, lineItems, payments, creditNotes, notes }}
      />

      <InvoiceLineItemsCard
        lineItems={lineItems}
        onCreate={() => {
          setEditingLineItem(undefined)
          setLineItemDialogOpen(true)
        }}
        onEdit={(lineItem) => {
          setEditingLineItem(lineItem)
          setLineItemDialogOpen(true)
        }}
        onDelete={(lineId) => {
          if (confirm(messages.finance.detailPage.deleteLineItemConfirm)) {
            deleteLineItem.mutate(lineId)
          }
        }}
      />

      <InvoiceAttachmentsCard invoiceId={id} />

      <InvoicePaymentsCard payments={payments} onCreate={() => setPaymentDialogOpen(true)} />

      <InvoiceCreditNotesCard
        creditNotes={creditNotes}
        onCreate={() => setCreditNoteDialogOpen(true)}
      />

      <InvoiceNotesCard
        noteContent={noteContent}
        isAdding={addNoteMutation.isPending}
        notes={notes}
        onNoteChange={setNoteContent}
        onAddNote={() =>
          addNoteMutation.mutate(
            { content: noteContent.trim() },
            {
              onSuccess: () => {
                setNoteContent("")
              },
            },
          )
        }
      />

      <InvoiceActionLedgerCard invoiceId={invoice.id} />

      <InvoiceDialog open={editOpen} onOpenChange={setEditOpen} invoice={invoice} />

      <LineItemDialog
        open={lineItemDialogOpen}
        onOpenChange={setLineItemDialogOpen}
        invoiceId={id}
        lineItem={editingLineItem}
        onSuccess={() => {
          setEditingLineItem(undefined)
        }}
      />

      <PaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        invoiceId={id}
        invoiceCurrency={invoice.currency}
      />

      <CreditNoteDialog
        open={creditNoteDialogOpen}
        onOpenChange={setCreditNoteDialogOpen}
        invoiceId={id}
        invoiceCurrency={invoice.currency}
      />
    </div>
  )
}
