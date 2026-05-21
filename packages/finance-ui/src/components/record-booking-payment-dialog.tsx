"use client"

import {
  type PaymentMethod,
  type PaymentStatus,
  paymentMethodSchema,
  paymentStatusSchema,
  useInvoicePaymentMutation,
  useInvoices,
} from "@voyantjs/finance-react"
import { formatMessage } from "@voyantjs/i18n"
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@voyantjs/ui/components"
import { CurrencyInput } from "@voyantjs/ui/components/currency-input"
import { DatePicker } from "@voyantjs/ui/components/date-picker"
import { Loader2 } from "lucide-react"
import * as React from "react"

import { useFinanceUiMessagesOrDefault } from "../i18n/index.js"

const PAYMENT_METHODS = paymentMethodSchema.options
const PAYMENT_STATUSES = paymentStatusSchema.options

export interface RecordBookingPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: string
  /** Pre-fill currency when no invoices have loaded yet. */
  defaultCurrency?: string
  onRecorded?: () => void
}

interface FormState {
  invoiceId: string
  amountCents: number
  currency: string
  paymentMethod: PaymentMethod
  status: PaymentStatus
  paymentDate: string
  referenceNumber: string
  notes: string
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function buildInitialFormState(currency: string): FormState {
  return {
    invoiceId: "",
    amountCents: 0,
    currency,
    paymentMethod: "bank_transfer",
    status: "completed",
    paymentDate: todayIso(),
    referenceNumber: "",
    notes: "",
  }
}

function formatAmount(cents: number): string {
  return (cents / 100).toFixed(2)
}

export function RecordBookingPaymentDialog({
  open,
  onOpenChange,
  bookingId,
  defaultCurrency = "EUR",
  onRecorded,
}: RecordBookingPaymentDialogProps) {
  const messages = useFinanceUiMessagesOrDefault()
  const dialog = messages.recordBookingPaymentDialog
  const methodLabels = messages.common.paymentMethodLabels
  const statusLabels = messages.common.supplierPaymentStatusLabels

  const invoicesQuery = useInvoices({ bookingId, enabled: open })
  const invoices = invoicesQuery.data?.data ?? []
  const outstandingInvoices = invoices.filter((inv) => inv.balanceDueCents > 0)
  const selectableInvoices = outstandingInvoices.length > 0 ? outstandingInvoices : invoices

  const [state, setState] = React.useState<FormState>(() => buildInitialFormState(defaultCurrency))
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  const initializedRef = React.useRef(false)

  // When the dialog opens, reset to defaults. Once invoices load, auto-pick
  // the only outstanding invoice (or the first invoice) and pre-fill the
  // amount with its balance due — what the operator almost always wants.
  React.useEffect(() => {
    if (!open) {
      initializedRef.current = false
      setSubmitError(null)
      return
    }
    if (!initializedRef.current && !invoicesQuery.isLoading) {
      const target = selectableInvoices[0]
      setState({
        ...buildInitialFormState(defaultCurrency),
        invoiceId: target?.id ?? "",
        amountCents: target?.balanceDueCents ?? 0,
        currency: target?.currency ?? defaultCurrency,
      })
      initializedRef.current = true
    }
  }, [open, invoicesQuery.isLoading, selectableInvoices, defaultCurrency])

  const selectedInvoice = invoices.find((inv) => inv.id === state.invoiceId) ?? null
  const mutation = useInvoicePaymentMutation(state.invoiceId)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitError(null)
    if (!state.invoiceId) {
      setSubmitError(dialog.validation.invoiceRequired)
      return
    }
    if (state.amountCents <= 0) {
      setSubmitError(dialog.validation.amountMinimum)
      return
    }
    try {
      await mutation.mutateAsync({
        amountCents: state.amountCents,
        currency: state.currency,
        paymentMethod: state.paymentMethod,
        status: state.status,
        paymentDate: state.paymentDate,
        referenceNumber: state.referenceNumber.trim() === "" ? null : state.referenceNumber.trim(),
        notes: state.notes.trim() === "" ? null : state.notes.trim(),
      })
      onOpenChange(false)
      onRecorded?.()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : dialog.validation.recordFailed)
    }
  }

  const descriptionParts = dialog.description.split("{generateLink}")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{dialog.title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              {descriptionParts[0]}
              <span className="font-medium">{dialog.generateLinkLabel}</span>
              {descriptionParts[1]}
            </p>

            <div className="flex flex-col gap-2">
              <Label htmlFor="record-invoice">{dialog.fields.invoice}</Label>
              {invoicesQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">{dialog.loadingInvoices}</p>
              ) : selectableInvoices.length === 0 ? (
                <p className="text-sm text-destructive">{dialog.noInvoices}</p>
              ) : (
                <Select
                  value={state.invoiceId}
                  onValueChange={(value) => {
                    const id = value ?? ""
                    const next = invoices.find((inv) => inv.id === id)
                    setState((prev) => ({
                      ...prev,
                      invoiceId: id,
                      amountCents: next?.balanceDueCents ?? prev.amountCents,
                      currency: next?.currency ?? prev.currency,
                    }))
                  }}
                >
                  <SelectTrigger id="record-invoice" className="w-full">
                    <SelectValue placeholder={dialog.placeholders.invoice} />
                  </SelectTrigger>
                  <SelectContent>
                    {selectableInvoices.map((inv) => (
                      <SelectItem key={inv.id} value={inv.id}>
                        {formatMessage(dialog.invoiceOption, {
                          number: inv.invoiceNumber,
                          status: inv.status,
                          balance: formatAmount(inv.balanceDueCents),
                          currency: inv.currency,
                        })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {selectedInvoice ? (
                <p className="text-xs text-muted-foreground">
                  {formatMessage(dialog.invoiceMeta, {
                    total: formatAmount(selectedInvoice.totalCents),
                    paid: formatAmount(selectedInvoice.paidCents),
                    due: formatAmount(selectedInvoice.balanceDueCents),
                    currency: selectedInvoice.currency,
                  })}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="record-amount">{dialog.fields.amountCents}</Label>
                <CurrencyInput
                  value={state.amountCents}
                  onChange={(next) => set("amountCents", next ?? 0)}
                  currency={state.currency}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="record-date">{dialog.fields.paymentDate}</Label>
                <DatePicker
                  value={state.paymentDate || null}
                  onChange={(next) => set("paymentDate", next ?? "")}
                  className="w-full"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialog.fields.status}</Label>
                <Select
                  value={state.status}
                  onValueChange={(value) => set("status", (value ?? "completed") as PaymentStatus)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_STATUSES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {statusLabels[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{dialog.fields.paymentMethod}</Label>
                <Select
                  value={state.paymentMethod}
                  onValueChange={(value) =>
                    set("paymentMethod", (value ?? "bank_transfer") as PaymentMethod)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {methodLabels[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="record-ref">{dialog.fields.referenceNumber}</Label>
                <Input
                  id="record-ref"
                  value={state.referenceNumber}
                  onChange={(event) => set("referenceNumber", event.target.value)}
                  placeholder={dialog.placeholders.referenceNumber}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="record-notes">{dialog.fields.notes}</Label>
              <Textarea
                id="record-notes"
                value={state.notes}
                onChange={(event) => set("notes", event.target.value)}
                rows={3}
              />
            </div>

            {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || !state.invoiceId || state.amountCents <= 0}
            >
              {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {dialog.actions.record}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
