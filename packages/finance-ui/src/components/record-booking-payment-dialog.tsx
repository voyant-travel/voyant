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
import { CurrencyCombobox } from "@voyantjs/ui/components/currency-combobox"
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
  baseAmountCents: number
  fxRate: string
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
    baseAmountCents: 0,
    fxRate: "",
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

function normalizeCurrency(currency: string | null | undefined): string {
  return currency?.trim().toUpperCase() ?? ""
}

function parseFxRate(raw: string): number | null {
  const normalized = raw.trim().replace(",", ".")
  if (!normalized) return null
  const value = Number.parseFloat(normalized)
  return Number.isFinite(value) && value > 0 ? value : null
}

function deriveBaseAmountCents(amountCents: number, fxRateRaw: string): number | null {
  const fxRate = parseFxRate(fxRateRaw)
  if (!fxRate || amountCents <= 0) return null
  return Math.round(amountCents / fxRate)
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
        baseAmountCents: 0,
        fxRate: "",
      })
      initializedRef.current = true
    }
  }, [open, invoicesQuery.isLoading, selectableInvoices, defaultCurrency])

  const selectedInvoice = invoices.find((inv) => inv.id === state.invoiceId) ?? null
  const invoiceCurrency = selectedInvoice?.currency ?? ""
  const normalizedInvoiceCurrency = normalizeCurrency(invoiceCurrency)
  const paymentCurrency = normalizeCurrency(state.currency)
  const isCrossCurrency = Boolean(
    normalizedInvoiceCurrency && paymentCurrency && normalizedInvoiceCurrency !== paymentCurrency,
  )
  const requiresBaseAmount = isCrossCurrency && state.status === "completed"
  const mutation = useInvoicePaymentMutation(state.invoiceId)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }))

  const setAmountCents = (amountCents: number) => {
    setState((prev) => ({
      ...prev,
      amountCents,
      baseAmountCents: deriveBaseAmountCents(amountCents, prev.fxRate) ?? prev.baseAmountCents,
    }))
  }

  const setPaymentCurrency = (currency: string) => {
    const nextCurrency = normalizeCurrency(currency) || normalizedInvoiceCurrency || defaultCurrency
    setState((prev) => ({
      ...prev,
      amountCents:
        normalizedInvoiceCurrency &&
        nextCurrency !== normalizedInvoiceCurrency &&
        normalizeCurrency(prev.currency) === normalizedInvoiceCurrency &&
        prev.amountCents === selectedInvoice?.balanceDueCents
          ? 0
          : prev.amountCents,
      currency: nextCurrency,
      baseAmountCents:
        normalizedInvoiceCurrency && nextCurrency !== normalizedInvoiceCurrency
          ? prev.baseAmountCents || selectedInvoice?.balanceDueCents || 0
          : 0,
      fxRate:
        normalizedInvoiceCurrency && nextCurrency !== normalizedInvoiceCurrency ? prev.fxRate : "",
    }))
  }

  const setFxRate = (fxRate: string) => {
    setState((prev) => ({
      ...prev,
      fxRate,
      baseAmountCents: deriveBaseAmountCents(prev.amountCents, fxRate) ?? prev.baseAmountCents,
    }))
  }

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
    if (requiresBaseAmount && state.baseAmountCents <= 0) {
      setSubmitError(dialog.validation.baseAmountRequired)
      return
    }
    try {
      await mutation.mutateAsync({
        amountCents: state.amountCents,
        currency: isCrossCurrency
          ? paymentCurrency || state.currency
          : invoiceCurrency || state.currency,
        baseCurrency: isCrossCurrency ? invoiceCurrency : null,
        baseAmountCents:
          isCrossCurrency && state.baseAmountCents > 0 ? state.baseAmountCents : null,
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
                      baseAmountCents: 0,
                      fxRate: "",
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

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="record-amount">{dialog.fields.amountCents}</Label>
                <CurrencyInput
                  id="record-amount"
                  value={state.amountCents}
                  onChange={(next) => setAmountCents(next ?? 0)}
                  currency={state.currency}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialog.fields.currency}</Label>
                <CurrencyCombobox
                  value={state.currency || null}
                  onChange={(next) =>
                    setPaymentCurrency(next ?? selectedInvoice?.currency ?? defaultCurrency)
                  }
                  placeholder={dialog.placeholders.currency}
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
            </div>

            {isCrossCurrency ? (
              <div className="rounded-md border bg-muted/20 p-3">
                <div className="mb-3 space-y-1">
                  <h3 className="text-sm font-medium">{dialog.fx.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {formatMessage(dialog.fx.help, {
                      invoiceCurrency,
                      paymentCurrency,
                    })}
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="record-base-amount">{dialog.fields.baseAmountCents}</Label>
                    <CurrencyInput
                      id="record-base-amount"
                      value={state.baseAmountCents}
                      onChange={(next) => set("baseAmountCents", next ?? 0)}
                      currency={normalizedInvoiceCurrency || invoiceCurrency}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="record-fx-rate">{dialog.fields.fxRate}</Label>
                    <Input
                      id="record-fx-rate"
                      value={state.fxRate}
                      onChange={(event) => setFxRate(event.target.value)}
                      inputMode="decimal"
                      placeholder={formatMessage(dialog.placeholders.fxRate, {
                        invoiceCurrency,
                        paymentCurrency,
                      })}
                    />
                  </div>
                  <div className="flex items-end">
                    <p className="pb-2 text-xs text-muted-foreground">
                      {formatMessage(dialog.fx.rateHint, {
                        invoiceCurrency,
                        paymentCurrency,
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-3">
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
              disabled={
                mutation.isPending ||
                !state.invoiceId ||
                state.amountCents <= 0 ||
                (requiresBaseAmount && state.baseAmountCents <= 0)
              }
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
