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
import { InvoiceDialog } from "@voyantjs/finance-ui/components/invoice-dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Badge,
  Button,
  ConfirmActionButton,
  Textarea,
} from "@voyantjs/ui/components"
import { ArrowLeft, Ban, Loader2, Pencil } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { CreditNoteDialog } from "./credit-note-dialog"
import {
  InvoiceCreditNotesCard,
  InvoiceInfoCards,
  InvoiceLineItemsCard,
  InvoiceNotesCard,
  InvoicePaymentsCard,
} from "./invoice-detail-sections"
import { formatStatus, type LineItem, statusVariant } from "./invoice-detail-shared"
import { LineItemDialog } from "./line-item-dialog"
import { PaymentDialog } from "./payment-dialog"

export function InvoiceDetailPage({ id }: { id: string }) {
  const navigate = useNavigate()
  const [editOpen, setEditOpen] = useState(false)
  const [lineItemDialogOpen, setLineItemDialogOpen] = useState(false)
  const [editingLineItem, setEditingLineItem] = useState<LineItem | undefined>()
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [creditNoteDialogOpen, setCreditNoteDialogOpen] = useState(false)
  const [noteContent, setNoteContent] = useState("")
  const [voidDialogOpen, setVoidDialogOpen] = useState(false)
  const [voidReason, setVoidReason] = useState("")

  const { data: invoiceData, isPending } = useInvoice(id)
  const { data: lineItemsData } = useInvoiceLineItems(id)
  const paymentsQuery = useInvoicePayments(id)
  const creditNotesQuery = useInvoiceCreditNotes(id)
  const { data: notesData } = useInvoiceNotes(id)
  const { remove: deleteInvoice, voidInvoice } = useInvoiceMutation()
  const { remove: deleteLineItem } = useInvoiceLineItemMutation(id)
  const addNoteMutation = useInvoiceNoteMutation(id)

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const invoice = invoiceData?.data
  const payments = paymentsQuery.data?.data ?? []
  const creditNotes = creditNotesQuery.data?.data ?? []
  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">Invoice not found</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/finance" })}>
          Back to Finance
        </Button>
      </div>
    )
  }

  const canDelete = invoice.status === "draft"
  const canVoid =
    ["issued", "partially_paid", "overdue", "pending_external_allocation"].includes(
      invoice.status,
    ) &&
    !paymentsQuery.isPending &&
    !creditNotesQuery.isPending &&
    payments.length === 0 &&
    creditNotes.length === 0

  const showMutationError = (error: unknown, fallback: string) => {
    toast.error(error instanceof Error ? error.message : fallback)
  }

  const handleVoidInvoice = async () => {
    try {
      await voidInvoice.mutateAsync({
        id,
        input: { reason: voidReason.trim() || null },
      })
      toast.success("Invoice voided.")
      setVoidDialogOpen(false)
      setVoidReason("")
    } catch (error) {
      showMutationError(error, "Unable to void invoice")
    }
  }

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
              {formatStatus(invoice.status)}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <AlertDialog
            open={voidDialogOpen}
            onOpenChange={(open) => {
              setVoidDialogOpen(open)
              if (!open) setVoidReason("")
            }}
          >
            <AlertDialogTrigger
              disabled={!canVoid || voidInvoice.isPending}
              render={<Button type="button" variant="outline" />}
            >
              <Ban className="mr-2 h-4 w-4" />
              Void
            </AlertDialogTrigger>
            <AlertDialogContent size="sm">
              <AlertDialogHeader>
                <AlertDialogTitle>Void this invoice?</AlertDialogTitle>
                <AlertDialogDescription>
                  This marks the invoice as void, clears the outstanding balance, and keeps the
                  audit trail. Invoices with payments or credit notes need a credit note instead.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="grid gap-2">
                <Textarea
                  value={voidReason}
                  onChange={(event) => setVoidReason(event.target.value)}
                  placeholder="Reason for voiding..."
                  className="min-h-24"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={voidInvoice.isPending}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={voidInvoice.isPending}
                  onClick={() => void handleVoidInvoice()}
                >
                  {voidInvoice.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Void invoice
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <ConfirmActionButton
            buttonLabel="Delete"
            confirmLabel="Delete invoice"
            title="Delete this invoice?"
            description={
              canDelete
                ? "This permanently deletes the draft invoice."
                : "Only draft invoices can be deleted. Void issued invoices without payments or create a credit note."
            }
            variant="destructive"
            confirmVariant="destructive"
            disabled={!canDelete || deleteInvoice.isPending}
            onConfirm={async () => {
              try {
                await deleteInvoice.mutateAsync(id)
                toast.success("Invoice deleted.")
                void navigate({ to: "/finance" })
              } catch (error) {
                showMutationError(error, "Unable to delete invoice")
              }
            }}
          />
        </div>
      </div>

      <InvoiceInfoCards
        invoice={invoice}
        onOpenBooking={() =>
          void navigate({
            to: "/bookings/$id",
            params: { id: invoice.bookingId },
          })
        }
      />

      <InvoiceLineItemsCard
        lineItems={lineItemsData?.data ?? []}
        onCreate={() => {
          setEditingLineItem(undefined)
          setLineItemDialogOpen(true)
        }}
        onEdit={(lineItem) => {
          setEditingLineItem(lineItem)
          setLineItemDialogOpen(true)
        }}
        deletePending={deleteLineItem.isPending}
        onDelete={async (lineId) => {
          try {
            await deleteLineItem.mutateAsync(lineId)
            toast.success("Line item deleted.")
          } catch (error) {
            showMutationError(error, "Unable to delete line item")
          }
        }}
      />

      <InvoicePaymentsCard payments={payments} onCreate={() => setPaymentDialogOpen(true)} />

      <InvoiceCreditNotesCard
        creditNotes={creditNotes}
        onCreate={() => setCreditNoteDialogOpen(true)}
      />

      <InvoiceNotesCard
        noteContent={noteContent}
        isAdding={addNoteMutation.isPending}
        notes={notesData?.data ?? []}
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
