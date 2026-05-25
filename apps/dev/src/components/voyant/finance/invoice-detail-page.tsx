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
  Textarea,
} from "@voyantjs/ui/components"
import { ArrowLeft, ArrowRightLeft, Ban, Loader2, Pencil, Trash2 } from "lucide-react"
import { useState } from "react"
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
  const [actionError, setActionError] = useState<string | null>(null)
  const [voidDialogOpen, setVoidDialogOpen] = useState(false)
  const [voidReason, setVoidReason] = useState("")

  const { data: invoiceData, isPending } = useInvoice(id)
  const { data: lineItemsData } = useInvoiceLineItems(id)
  const { data: paymentsData } = useInvoicePayments(id)
  const { data: creditNotesData } = useInvoiceCreditNotes(id)
  const { data: notesData } = useInvoiceNotes(id)
  const { convertToInvoice, remove: deleteInvoice, voidInvoice } = useInvoiceMutation()
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

  const canVoidInvoice = ["pending_external_allocation", "issued", "overdue"].includes(
    invoice.status,
  )
  const canConvertProforma = invoice.invoiceType === "proforma" && invoice.status !== "void"

  const getMutationErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback

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
          {canConvertProforma ? (
            <Button
              variant="outline"
              disabled={convertToInvoice.isPending}
              onClick={() => {
                if (
                  !confirm(
                    "Convert this proforma into a final invoice? The proforma will be voided.",
                  )
                ) {
                  return
                }
                setActionError(null)
                convertToInvoice.mutate(
                  { id },
                  {
                    onSuccess: (converted) => {
                      void navigate({ to: "/finance/invoices/$id", params: { id: converted.id } })
                    },
                    onError: (error) => {
                      setActionError(getMutationErrorMessage(error, "Could not convert invoice"))
                    },
                  },
                )
              }}
            >
              {convertToInvoice.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ArrowRightLeft className="mr-2 h-4 w-4" />
              )}
              Convert to invoice
            </Button>
          ) : null}
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
              disabled={!canVoidInvoice || voidInvoice.isPending}
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
                  audit trail.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Textarea
                value={voidReason}
                onChange={(event) => setVoidReason(event.target.value)}
                placeholder="Reason for voiding..."
                className="min-h-24"
              />
              <AlertDialogFooter>
                <AlertDialogCancel disabled={voidInvoice.isPending}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={voidInvoice.isPending}
                  onClick={() => {
                    setActionError(null)
                    voidInvoice.mutate(
                      { id, input: { reason: voidReason.trim() || null } },
                      {
                        onSuccess: () => {
                          setVoidDialogOpen(false)
                          setVoidReason("")
                        },
                        onError: (error) => {
                          setActionError(getMutationErrorMessage(error, "Could not void invoice"))
                        },
                      },
                    )
                  }}
                >
                  {voidInvoice.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  Void
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            variant="destructive"
            onClick={() => {
              if (invoice.status !== "draft") {
                alert("Only draft invoices can be deleted")
                return
              }
              if (confirm("Are you sure you want to delete this invoice?")) {
                setActionError(null)
                deleteInvoice.mutate(id, {
                  onSuccess: () => {
                    void navigate({ to: "/finance" })
                  },
                  onError: (error) => {
                    setActionError(getMutationErrorMessage(error, "Could not delete invoice"))
                  },
                })
              }
            }}
            disabled={deleteInvoice.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>
      {actionError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm">
          {actionError}
        </div>
      ) : null}

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
        onDelete={(lineId) => {
          if (confirm("Delete this line item?")) {
            setActionError(null)
            deleteLineItem.mutate(lineId, {
              onError: (error) => {
                setActionError(getMutationErrorMessage(error, "Could not delete line item"))
              },
            })
          }
        }}
      />

      <InvoicePaymentsCard
        payments={paymentsData?.data ?? []}
        onCreate={() => setPaymentDialogOpen(true)}
        canCreate={invoice.status !== "void"}
      />

      <InvoiceCreditNotesCard
        creditNotes={creditNotesData?.data ?? []}
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
