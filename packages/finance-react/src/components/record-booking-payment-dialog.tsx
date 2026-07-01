"use client"

import { formatMessage } from "@voyant-travel/i18n"
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from "@voyant-travel/ui/components"
import { CurrencyCombobox } from "@voyant-travel/ui/components/currency-combobox"
import { CurrencyInput } from "@voyant-travel/ui/components/currency-input"
import { DatePicker } from "@voyant-travel/ui/components/date-picker"
import { Loader2 } from "lucide-react"
import * as React from "react"
import { useFinanceUiMessagesOrDefault } from "../i18n/index.js"
import {
  type PaymentMethod,
  type PaymentStatus,
  useInvoiceFxRate,
  useInvoiceMutation,
  useInvoicePaymentMutation,
  useInvoices,
  usePaymentMutation,
} from "../index.js"
import type {
  FormState,
  RecordBookingPaymentDialogProps,
} from "./record-booking-payment-dialog/shared.js"
import {
  buildInitialFormState,
  deriveBaseAmountCents,
  formatAmount,
  formatCommissionPercent,
  formatFxRateInput,
  formatRateDisplay,
  normalizeCurrency,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  parseFxRate,
} from "./record-booking-payment-dialog/shared.js"

const PAYABLE_INVOICE_STATUSES = new Set(["issued", "partially_paid", "overdue"])

export type {
  EditingPaymentSnapshot,
  RecordBookingPaymentDialogProps,
} from "./record-booking-payment-dialog/shared.js"

export function RecordBookingPaymentDialog({
  open,
  onOpenChange,
  bookingId,
  defaultCurrency = "EUR",
  onRecorded,
  editingPayment = null,
}: RecordBookingPaymentDialogProps) {
  const messages = useFinanceUiMessagesOrDefault()
  const dialog = messages.recordBookingPaymentDialog
  const methodLabels = messages.common.paymentMethodLabels
  const statusLabels = messages.common.supplierPaymentStatusLabels
  const isEditing = Boolean(editingPayment)

  const invoicesQuery = useInvoices({ bookingId, enabled: open })
  const invoices = invoicesQuery.data?.data ?? []
  // Operator records a payment against issued receivables still owed. Drafts
  // and external-allocation placeholders are not payable yet, even when they
  // carry a balance, so keep them out of the settlement picker.
  const selectableInvoices = invoices.filter(
    (inv) => PAYABLE_INVOICE_STATUSES.has(inv.status) && inv.balanceDueCents > 0,
  )
  const hasExcludedInvoicesWithBalance = invoices.some(
    (inv) => inv.balanceDueCents > 0 && !PAYABLE_INVOICE_STATUSES.has(inv.status),
  )

  const [state, setState] = React.useState<FormState>(() => buildInitialFormState(defaultCurrency))
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  const [convertProformaAfter, setConvertProformaAfter] = React.useState(false)
  const convertProformaTouchedRef = React.useRef(false)
  const initializedRef = React.useRef(false)

  // Reset on close; in edit mode, prefill from the snapshot once the
  // invoices list loads. In create mode the operator picks an invoice
  // explicitly — selecting one fills amount/currency from the row.
  // biome-ignore lint/correctness/useExhaustiveDependencies: one-shot init guarded by `initializedRef`; we intentionally don't re-fire when the derived `selectableInvoices[0]` reference changes
  React.useEffect(() => {
    if (!open) {
      initializedRef.current = false
      setSubmitError(null)
      setConvertProformaAfter(false)
      convertProformaTouchedRef.current = false
      return
    }
    if (!initializedRef.current && !invoicesQuery.isLoading) {
      if (editingPayment) {
        setState({
          ...buildInitialFormState(defaultCurrency),
          invoiceId: editingPayment.invoiceId,
          amountCents: editingPayment.amountCents,
          currency: editingPayment.currency,
          paymentMethod: editingPayment.paymentMethod,
          status: editingPayment.status,
          paymentDate: editingPayment.paymentDate,
          referenceNumber: editingPayment.referenceNumber ?? "",
          notes: editingPayment.notes ?? "",
        })
      } else {
        // Auto-select the first outstanding invoice so the operator
        // doesn't have to click the picker when there's only one
        // option (the common case). The user can still re-pick from
        // the dropdown.
        const target = selectableInvoices[0]
        setState({
          ...buildInitialFormState(defaultCurrency),
          invoiceId: target?.id ?? "",
          amountCents: target?.balanceDueCents ?? 0,
          currency: target?.currency ?? defaultCurrency,
        })
      }
      initializedRef.current = true
    }
  }, [open, invoicesQuery.isLoading, defaultCurrency, editingPayment])

  const selectedInvoice = invoices.find((inv) => inv.id === state.invoiceId) ?? null
  const invoiceCurrency = selectedInvoice?.currency ?? ""
  const normalizedInvoiceCurrency = normalizeCurrency(invoiceCurrency)
  const paymentCurrency = normalizeCurrency(state.currency)
  const isCrossCurrency = Boolean(
    normalizedInvoiceCurrency && paymentCurrency && normalizedInvoiceCurrency !== paymentCurrency,
  )
  const requiresBaseAmount = isCrossCurrency && state.status === "completed"
  const createMutation = useInvoicePaymentMutation(state.invoiceId)
  const { update: updateMutation } = usePaymentMutation()
  const { convertToInvoice: convertProformaMutation } = useInvoiceMutation()
  // Only offer the proforma→invoice conversion when (a) recording a
  // brand-new payment (not editing), (b) the selected invoice is a
  // proforma, (c) the payment is being marked completed (a pending or
  // failed payment shouldn't trigger conversion).
  const isProformaSelected = selectedInvoice?.invoiceType === "proforma"
  const canConvertProformaAfter = !isEditing && isProformaSelected && state.status === "completed"
  const isPending = isEditing ? updateMutation.isPending : createMutation.isPending
  const fxRateQuery = useInvoiceFxRate({
    baseCurrency: normalizedInvoiceCurrency || undefined,
    quoteCurrency: paymentCurrency || undefined,
    date: state.paymentDate || undefined,
    enabled: open && isCrossCurrency,
  })
  const autoFxData = fxRateQuery.data?.data
  const autoEffectiveRate =
    typeof autoFxData?.effectiveRate === "number" && autoFxData.effectiveRate > 0
      ? autoFxData.effectiveRate
      : null
  const autoRawRate =
    typeof autoFxData?.rate === "number" && autoFxData.rate > 0 ? autoFxData.rate : null
  const autoCommissionBps = autoFxData?.fxCommissionBps ?? 0

  const manualRate = state.fxOverride ? parseFxRate(state.fxRate) : null
  const effectiveFxRate = state.fxOverride ? manualRate : autoEffectiveRate
  const baseAmountCents = isCrossCurrency
    ? (deriveBaseAmountCents(state.amountCents, effectiveFxRate) ?? 0)
    : 0
  const autoRateUnavailable =
    isCrossCurrency &&
    !state.fxOverride &&
    !fxRateQuery.isFetching &&
    !autoEffectiveRate &&
    fxRateQuery.isFetched

  // Heuristic: prefill the "Convert proforma to invoice" switch ON
  // only when this payment will close the proforma — i.e. the entered
  // amount (in invoice currency, directly or via FX) covers the
  // invoice's remaining balance. Partial payments stay off since the
  // proforma still has balance due after recording. The operator can
  // override either way; once they toggle, we freeze the choice.
  const fullyCoversInvoiceBalance =
    selectedInvoice != null &&
    selectedInvoice.balanceDueCents > 0 &&
    (isCrossCurrency
      ? baseAmountCents > 0 && baseAmountCents >= selectedInvoice.balanceDueCents
      : state.amountCents > 0 && state.amountCents >= selectedInvoice.balanceDueCents)
  React.useEffect(() => {
    if (convertProformaTouchedRef.current) return
    setConvertProformaAfter(canConvertProformaAfter && fullyCoversInvoiceBalance)
  }, [canConvertProformaAfter, fullyCoversInvoiceBalance])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }))

  const setPaymentCurrency = (currency: string) => {
    const nextCurrency = normalizeCurrency(currency) || normalizedInvoiceCurrency || defaultCurrency
    setState((prev) => {
      const previousCurrency = normalizeCurrency(prev.currency)
      const sameCurrency = previousCurrency === nextCurrency
      const nextIsCrossCurrency =
        Boolean(normalizedInvoiceCurrency) && nextCurrency !== normalizedInvoiceCurrency

      return {
        ...prev,
        amountCents:
          nextIsCrossCurrency &&
          previousCurrency === normalizedInvoiceCurrency &&
          prev.amountCents === selectedInvoice?.balanceDueCents
            ? 0
            : prev.amountCents,
        currency: nextCurrency,
        fxOverride: sameCurrency ? prev.fxOverride : false,
        fxRate: sameCurrency ? prev.fxRate : "",
      }
    })
  }

  const toggleOverride = (next: boolean) => {
    setState((prev) => ({
      ...prev,
      fxOverride: next,
      fxRate:
        next && !prev.fxRate && autoEffectiveRate
          ? formatFxRateInput(autoEffectiveRate)
          : prev.fxRate,
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
    if (requiresBaseAmount && baseAmountCents <= 0) {
      setSubmitError(dialog.validation.baseAmountRequired)
      return
    }
    const payload = {
      amountCents: state.amountCents,
      currency: isCrossCurrency
        ? paymentCurrency || state.currency
        : invoiceCurrency || state.currency,
      baseCurrency: isCrossCurrency ? invoiceCurrency : null,
      baseAmountCents: isCrossCurrency && baseAmountCents > 0 ? baseAmountCents : null,
      paymentMethod: state.paymentMethod,
      status: state.status,
      paymentDate: state.paymentDate,
      referenceNumber: state.referenceNumber.trim() === "" ? null : state.referenceNumber.trim(),
      notes: state.notes.trim() === "" ? null : state.notes.trim(),
    }
    try {
      if (isEditing && editingPayment) {
        await updateMutation.mutateAsync({ id: editingPayment.id, input: payload })
      } else {
        await createMutation.mutateAsync(payload)
        // The proforma → final invoice conversion is the last step so a
        // failure here doesn't roll back the payment (it's already in).
        // Server-side `convert-to-invoice` voids the proforma, creates
        // the final invoice, and moves payments onto it — exactly what
        // the operator would otherwise do by hand from the Invoices tab.
        if (canConvertProformaAfter && convertProformaAfter && selectedInvoice) {
          await convertProformaMutation.mutateAsync({ id: selectedInvoice.id })
        }
      }
      onOpenChange(false)
      onRecorded?.()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : dialog.validation.recordFailed)
    }
  }

  const showEmptyState = !isEditing && !invoicesQuery.isLoading && selectableInvoices.length === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="gap-0 p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{isEditing ? dialog.editTitle : dialog.title}</DialogTitle>
        </DialogHeader>

        {showEmptyState ? (
          <>
            <div className="px-6 py-6">
              <p className="text-sm text-muted-foreground">{dialog.noInvoices}</p>
              {hasExcludedInvoicesWithBalance ? (
                <p className="mt-2 text-xs text-muted-foreground">{dialog.payableStatusHint}</p>
              ) : null}
            </div>
            <div className="flex items-center justify-end gap-2 px-6 pb-6">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {messages.common.cancel}
              </Button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-5 px-6 py-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="record-invoice">{dialog.fields.invoice}</Label>
                {invoicesQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">{dialog.loadingInvoices}</p>
                ) : (
                  <Select
                    value={state.invoiceId}
                    disabled={isEditing}
                    onValueChange={(value) => {
                      const id = value ?? ""
                      const next = invoices.find((inv) => inv.id === id)
                      setState((prev) => ({
                        ...prev,
                        invoiceId: id,
                        amountCents: next?.balanceDueCents ?? prev.amountCents,
                        currency: next?.currency ?? prev.currency,
                        fxOverride: false,
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
                {hasExcludedInvoicesWithBalance ? (
                  <p className="text-xs text-muted-foreground">{dialog.payableStatusHint}</p>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="record-amount">{dialog.fields.amountCents}</Label>
                  <CurrencyInput
                    id="record-amount"
                    value={state.amountCents}
                    onChange={(next) => set("amountCents", next ?? 0)}
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
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className="text-sm font-medium">{dialog.fx.title}</h3>
                      {fxRateQuery.isFetching ? (
                        <p className="text-xs text-muted-foreground">{dialog.fx.loadingRate}</p>
                      ) : autoRateUnavailable ? (
                        <p className="text-xs text-destructive">
                          {formatMessage(dialog.fx.rateUnavailable, {
                            invoiceCurrency,
                            paymentCurrency,
                          })}
                        </p>
                      ) : effectiveFxRate && baseAmountCents > 0 ? (
                        <>
                          <p className="text-sm">
                            {formatMessage(dialog.fx.summary, {
                              amount: formatAmount(state.amountCents),
                              paymentCurrency,
                              baseAmount: formatAmount(baseAmountCents),
                              invoiceCurrency,
                              rate: formatRateDisplay(effectiveFxRate),
                            })}
                          </p>
                          {!state.fxOverride && autoCommissionBps > 0 ? (
                            <p className="text-xs text-muted-foreground">
                              {formatMessage(dialog.fx.commissionNote, {
                                rawRate: autoRawRate ? formatRateDisplay(autoRawRate) : "",
                                commission: formatCommissionPercent(autoCommissionBps),
                                invoiceCurrency,
                                paymentCurrency,
                              })}
                            </p>
                          ) : !state.fxOverride && autoRawRate ? (
                            <p className="text-xs text-muted-foreground">{dialog.fx.source}</p>
                          ) : null}
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {formatMessage(dialog.fx.help, {
                            invoiceCurrency,
                            paymentCurrency,
                          })}
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleOverride(!state.fxOverride)}
                    >
                      {state.fxOverride ? dialog.fx.useAuto : dialog.fx.override}
                    </Button>
                  </div>
                  {state.fxOverride || autoRateUnavailable ? (
                    <div className="mt-3 flex flex-col gap-2 sm:max-w-xs">
                      <Label htmlFor="record-fx-rate">
                        {formatMessage(dialog.fields.fxRate, {
                          invoiceCurrency,
                          paymentCurrency,
                        })}
                      </Label>
                      <Input
                        id="record-fx-rate"
                        value={state.fxRate}
                        onChange={(event) =>
                          setState((prev) => ({
                            ...prev,
                            fxOverride: true,
                            fxRate: event.target.value,
                          }))
                        }
                        inputMode="decimal"
                        placeholder={formatMessage(dialog.placeholders.fxRate, {
                          invoiceCurrency,
                          paymentCurrency,
                        })}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>{dialog.fields.status}</Label>
                  <Select
                    value={state.status}
                    onValueChange={(value) =>
                      set("status", (value ?? "completed") as PaymentStatus)
                    }
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

              <div className="flex flex-col gap-2">
                <Label htmlFor="record-notes">{dialog.fields.notes}</Label>
                <Textarea
                  id="record-notes"
                  value={state.notes}
                  onChange={(event) => set("notes", event.target.value)}
                  rows={3}
                />
              </div>

              {canConvertProformaAfter ? (
                <div className="flex items-start justify-between gap-3 rounded-md border bg-muted/20 px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <Label
                      htmlFor="record-convert-proforma"
                      className="cursor-pointer"
                      onClick={() => setConvertProformaAfter((v) => !v)}
                    >
                      {dialog.fields.convertProformaAfter}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {dialog.fields.convertProformaAfterHint}
                    </p>
                  </div>
                  <Switch
                    id="record-convert-proforma"
                    checked={convertProformaAfter}
                    onCheckedChange={(next) => {
                      convertProformaTouchedRef.current = true
                      setConvertProformaAfter(next)
                    }}
                  />
                </div>
              ) : null}

              {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
            </div>
            <div className="flex items-center justify-end gap-2 px-6 pb-6">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {messages.common.cancel}
              </Button>
              <Button
                type="submit"
                disabled={
                  isPending ||
                  !state.invoiceId ||
                  state.amountCents <= 0 ||
                  (requiresBaseAmount && baseAmountCents <= 0)
                }
              >
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isEditing ? dialog.actions.save : dialog.actions.record}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
