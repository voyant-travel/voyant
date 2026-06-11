"use client"

import {
  AdminWidgetSlotRenderer,
  type OperatorAdminMessages,
  useAdminNavigate,
  useOperatorAdminMessages,
} from "@voyantjs/admin"
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

import { InvoiceActionLedgerCard } from "../components/invoice-action-ledger-card.js"
import { InvoiceDialog } from "../components/invoice-dialog.js"
import { CreditNoteDialog } from "./credit-note-dialog.js"
import { invoiceStatusVariant, type LineItem } from "./finance-shared.js"
import {
  InvoiceAttachmentsCard,
  InvoiceCreditNotesCard,
  InvoiceInfoCards,
  InvoiceLineItemsCard,
  InvoiceNotesCard,
  InvoicePaymentsCard,
} from "./invoice-detail-sections.js"
import { InvoiceDetailSkeleton } from "./invoice-detail-skeleton.js"
import { LineItemDialog } from "./line-item-dialog.js"
import { PaymentDialog } from "./payment-dialog.js"

function getInvoiceStatusLabel(messages: OperatorAdminMessages, status: string): string {
  switch (status) {
    case "draft":
      return messages.finance.invoiceStatusDraft
    case "issued":
      return messages.finance.invoiceStatusIssued
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

export interface InvoiceDetailHostProps {
  id: string
}

/**
 * Packaged admin host for the operator-grade invoice detail page
 * (packaged-admin RFC Phase 3). Owns everything package-clean:
 *
 *   - Data access through `@voyantjs/finance-react` hooks (shared finance
 *     provider context — no app RPC client).
 *   - Cross-route links resolve through semantic destinations (RFC §4.7):
 *     `invoice.list` (back/after delete), `invoice.detail` (after a proforma
 *     converts), `booking.detail` — no host route tree import.
 *   - Admin widget extension points: the `invoice.details.header` and
 *     `invoice.details.after-summary` slots render through the shared
 *     `AdminWidgetSlotRenderer`, which reads the workspace shell's
 *     `AdminExtensionsProvider` context.
 */
export function InvoiceDetailHost({ id }: InvoiceDetailHostProps) {
  const messages = useOperatorAdminMessages()
  const navigateTo = useAdminNavigate()
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
    return <InvoiceDetailSkeleton />
  }

  const invoice = invoiceData?.data
  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">{messages.finance.detailPage.notFound}</p>
        <Button variant="outline" onClick={() => navigateTo("invoice.list", {})}>
          {messages.finance.detailPage.backToFinance}
        </Button>
      </div>
    )
  }

  const lineItems = lineItemsData?.data ?? []
  const payments = paymentsData?.data ?? []
  const creditNotes = creditNotesData?.data ?? []
  const notes = notesData?.data ?? []
  const canVoidInvoice = ["pending_external_allocation", "issued", "overdue"].includes(
    invoice.status,
  )
  const canConvertProforma = invoice.invoiceType === "proforma" && invoice.status !== "void"

  const getMutationErrorMessage = (fallback: string) => (error: unknown) =>
    error instanceof Error ? error.message : fallback

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigateTo("invoice.list", {})}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{invoice.invoiceNumber}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge
              variant={invoiceStatusVariant[invoice.status] ?? "secondary"}
              className="capitalize"
            >
              {getInvoiceStatusLabel(messages, invoice.status)}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canConvertProforma ? (
            <Button
              variant="outline"
              disabled={convertToInvoice.isPending}
              onClick={() => {
                if (!confirm(messages.finance.convertConfirm)) return
                setActionError(null)
                convertToInvoice.mutate(
                  { id },
                  {
                    onSuccess: (converted) => {
                      navigateTo("invoice.detail", { invoiceId: converted.id })
                    },
                    onError: (error) => {
                      setActionError(
                        getMutationErrorMessage(messages.finance.detailPage.convertFailed)(error),
                      )
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
              {messages.finance.convertToInvoice}
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            {messages.finance.detailPage.edit}
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
              {messages.finance.detailPage.void}
            </AlertDialogTrigger>
            <AlertDialogContent size="sm">
              <AlertDialogHeader>
                <AlertDialogTitle>{messages.finance.detailPage.voidConfirm}</AlertDialogTitle>
                <AlertDialogDescription>
                  {messages.finance.detailPage.voidDescription}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Textarea
                value={voidReason}
                onChange={(event) => setVoidReason(event.target.value)}
                placeholder={messages.finance.detailPage.voidReasonPlaceholder}
                className="min-h-24"
              />
              <AlertDialogFooter>
                <AlertDialogCancel disabled={voidInvoice.isPending}>
                  {messages.finance.detailPage.cancel}
                </AlertDialogCancel>
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
                          setActionError(
                            getMutationErrorMessage(messages.finance.detailPage.voidFailed)(error),
                          )
                        },
                      },
                    )
                  }}
                >
                  {voidInvoice.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  {messages.finance.detailPage.void}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            variant="destructive"
            onClick={() => {
              if (invoice.status !== "draft") {
                alert(messages.finance.detailPage.deleteOnlyDraftAlert)
                return
              }
              if (confirm(messages.finance.detailPage.deleteConfirm)) {
                setActionError(null)
                deleteInvoice.mutate(id, {
                  onSuccess: () => {
                    navigateTo("invoice.list", {})
                  },
                  onError: (error) => {
                    setActionError(
                      getMutationErrorMessage(messages.finance.detailPage.deleteOnlyDraftAlert)(
                        error,
                      ),
                    )
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
      {actionError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm">
          {actionError}
        </div>
      ) : null}
      <AdminWidgetSlotRenderer slot="invoice.details.header" props={{ invoice }} />

      <InvoiceInfoCards
        invoice={invoice}
        onOpenBooking={() => navigateTo("booking.detail", { bookingId: invoice.bookingId })}
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
            setActionError(null)
            deleteLineItem.mutate(lineId, {
              onError: (error) => {
                setActionError(
                  getMutationErrorMessage(messages.finance.detailPage.deleteLineItemFailed)(error),
                )
              },
            })
          }
        }}
      />

      <InvoiceAttachmentsCard invoiceId={id} />

      <InvoicePaymentsCard
        payments={payments}
        onCreate={() => setPaymentDialogOpen(true)}
        canCreate={invoice.status !== "void"}
      />

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
