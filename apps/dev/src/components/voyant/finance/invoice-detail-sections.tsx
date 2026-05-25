import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Textarea,
} from "@voyantjs/ui/components"
import { Pencil, Plus, Trash2 } from "lucide-react"

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

export function InvoiceInfoCards({
  invoice,
  onOpenBooking,
}: {
  invoice: InvoiceDetail
  onOpenBooking: () => void
}) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Invoice Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Currency:</span> <span>{invoice.currency}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Subtotal:</span>{" "}
            <span className="font-mono">
              {formatAmount(invoice.subtotalCents, invoice.currency)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Tax:</span>{" "}
            <span className="font-mono">{formatAmount(invoice.taxCents, invoice.currency)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Total:</span>{" "}
            <span className="font-mono font-semibold">
              {formatAmount(invoice.totalCents, invoice.currency)}
            </span>
          </div>
          <div className="mt-2 border-t pt-3">
            <span className="text-muted-foreground">Paid:</span>{" "}
            <span className="font-mono">{formatAmount(invoice.paidCents, invoice.currency)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Balance Due:</span>{" "}
            <span className="font-mono font-semibold">
              {formatAmount(invoice.balanceDueCents, invoice.currency)}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dates & Links</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Issue Date:</span>{" "}
            <span>{invoice.issueDate}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Due Date:</span> <span>{invoice.dueDate}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Booking:</span>{" "}
            <button type="button" className="text-primary underline" onClick={onOpenBooking}>
              View Booking
            </button>
          </div>
          {invoice.personId ? (
            <div>
              <span className="text-muted-foreground">Person:</span>{" "}
              <span className="font-mono text-xs">{invoice.personId}</span>
            </div>
          ) : null}
          {invoice.organizationId ? (
            <div>
              <span className="text-muted-foreground">Organization:</span>{" "}
              <span className="font-mono text-xs">{invoice.organizationId}</span>
            </div>
          ) : null}
          {invoice.notes ? (
            <div className="mt-2 border-t pt-3">
              <span className="text-muted-foreground">Notes:</span>
              <p className="mt-1 whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          ) : null}
          <div className="mt-2 border-t pt-3">
            <div>
              <span className="text-muted-foreground">Created:</span>{" "}
              <span>{new Date(invoice.createdAt).toLocaleDateString()}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Updated:</span>{" "}
              <span>{new Date(invoice.updatedAt).toLocaleDateString()}</span>
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
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Line Items</CardTitle>
        <Button size="sm" onClick={onCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Line Item
        </Button>
      </CardHeader>
      <CardContent>
        {lineItems.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No line items yet.</p>
        ) : (
          <div className="rounded border bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="p-2 text-left font-medium">Description</th>
                  <th className="p-2 text-right font-medium">Qty</th>
                  <th className="p-2 text-right font-medium">Unit Price</th>
                  <th className="p-2 text-right font-medium">Total</th>
                  <th className="p-2 text-right font-medium">Tax Rate</th>
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
                      {lineItem.taxRate != null ? `${(lineItem.taxRate / 100).toFixed(2)}%` : "-"}
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
  canCreate = true,
}: {
  payments: PaymentRow[]
  onCreate: () => void
  canCreate?: boolean
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Payments</CardTitle>
        {canCreate ? (
          <Button size="sm" onClick={onCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Record Payment
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No payments yet.</p>
        ) : (
          <div className="rounded border bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="p-2 text-left font-medium">Date</th>
                  <th className="p-2 text-left font-medium">Method</th>
                  <th className="p-2 text-right font-medium">Amount</th>
                  <th className="p-2 text-left font-medium">Status</th>
                  <th className="p-2 text-left font-medium">Reference</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-b last:border-b-0">
                    <td className="p-2">{payment.paymentDate}</td>
                    <td className="p-2 capitalize">{formatMethod(payment.paymentMethod)}</td>
                    <td className="p-2 text-right font-mono">
                      {formatAmount(payment.amountCents, payment.currency)}
                    </td>
                    <td className="p-2">
                      <Badge
                        variant={paymentStatusVariant[payment.status] ?? "secondary"}
                        className="text-xs capitalize"
                      >
                        {payment.status}
                      </Badge>
                    </td>
                    <td className="p-2">{payment.referenceNumber ?? "-"}</td>
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
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Credit Notes</CardTitle>
        <Button size="sm" onClick={onCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Credit Note
        </Button>
      </CardHeader>
      <CardContent>
        {creditNotes.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No credit notes yet.</p>
        ) : (
          <div className="rounded border bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="p-2 text-left font-medium">CN #</th>
                  <th className="p-2 text-right font-medium">Amount</th>
                  <th className="p-2 text-left font-medium">Reason</th>
                  <th className="p-2 text-left font-medium">Status</th>
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
                        {creditNote.status}
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Textarea
            value={noteContent}
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder="Add an internal note..."
          />
          <div className="flex justify-end">
            <Button disabled={isAdding || !noteContent.trim()} onClick={onAddNote}>
              Add Note
            </Button>
          </div>
        </div>
        {notes.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No notes yet.</p>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div key={note.id} className="rounded border p-3">
                <p className="whitespace-pre-wrap text-sm">{note.content}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(note.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
