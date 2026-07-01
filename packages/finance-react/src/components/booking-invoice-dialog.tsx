// agent-quality: file-size exception -- owner: finance-react; existing UI surface stays co-located until a dedicated split preserves behavior and tests.
"use client"

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Loader2, Paperclip, Plus, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useFinanceUiMessagesOrDefault } from "../i18n/index.js"
import {
  type BookingPaymentScheduleRecord,
  type InvoiceRecord,
  type PaymentMethod,
  useBookingPaymentSchedules,
  useInvoiceMutation,
  useVoyantFinanceContext,
} from "../index.js"

export type InvoiceTypeChoice = "invoice" | "proforma"
type SourceChoice = "custom" | "schedule"

interface LineItemDraft {
  id: string
  description: string
  quantity: number
  unitAmountCents: number
  taxRatePercent: number
}

export interface BookingInvoiceDialogUpload {
  storageKey: string
  mimeType: string
  fileSize: number
}

export interface BookingInvoiceDueDateResolverInput {
  issueDate: string
  dueDate: string
  invoiceType: InvoiceTypeChoice
  booking: {
    id: string
    currency: string
    amountCents: number | null
  }
  bookingPaymentSchedule: BookingPaymentScheduleRecord
}

export type BookingInvoiceDueDateResolver = (input: BookingInvoiceDueDateResolverInput) => string

export interface BookingInvoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: string
  /** Pre-fill the currency from the booking's sell currency. */
  defaultCurrency?: string
  /** Pre-fill subtotal/total from the booking's sell amount (in cents). */
  defaultAmountCents?: number | null
  /**
   * Upload a file's bytes to durable storage and return its location so
   * the dialog can attach it to the newly-created invoice. When omitted,
   * the attachments dropzone is hidden — the SmartBill-off branch can
   * still create the invoice, it just won't surface uploads. The
   * template owns the upload endpoint (e.g. `/api/v1/admin/uploads`) so the
   * dialog stays transport-agnostic.
   */
  uploadFile?: (file: File) => Promise<BookingInvoiceDialogUpload>
  /**
   * Tax % to pre-fill on the schedule-derived line item. The operator
   * template resolves this from the booking's primary product (e.g. via
   * `useBookingTaxPreview`) so the dialog mirrors the rate the server
   * would apply server-side at issuance. Defaults to 0 when omitted.
   */
  defaultScheduleTaxRatePercent?: number
  /**
   * Resolve the legal document due date when an invoice/proforma is
   * derived from a payment schedule. Defaults to the schedule due date
   * for backwards compatibility.
   */
  resolveScheduleDueDate?: BookingInvoiceDueDateResolver
  onSuccess?: (invoice: InvoiceRecord) => void
}

function generateInvoiceNumber(): string {
  const now = new Date()
  const y = now.getFullYear()
  const seq = String(Math.floor(Math.random() * 9000) + 1000)
  return `INV-${y}-${seq}` // i18n-literal-ok auto-generated id
}

function formatScheduleDate(iso: string, locale: string | undefined): string {
  try {
    return new Date(iso).toLocaleDateString(locale, { dateStyle: "medium" })
  } catch {
    return iso
  }
}

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`
  }
}

// Persisted as the invoice's line-item description, which ships with the
// PDF document itself. Voyant defaults to English at the data layer here;
// templates that need a Romanian/etc. PDF supply their own description
// resolver via the upcoming hook surface.
const SCHEDULE_DESCRIPTION_FALLBACK: Record<string, string> = {
  // i18n-literal-ok domain default for invoice line items
  deposit: "Deposit",
  // i18n-literal-ok domain default for invoice line items
  installment: "Installment",
  // i18n-literal-ok domain default for invoice line items
  balance: "Balance",
  // i18n-literal-ok domain default for invoice line items
  hold: "Hold",
  // i18n-literal-ok domain default for invoice line items
  other: "Payment",
}

function scheduleDescription(scheduleType: string | null | undefined): string {
  // i18n-literal-ok matches SCHEDULE_DESCRIPTION_FALLBACK above
  if (!scheduleType) return SCHEDULE_DESCRIPTION_FALLBACK.other ?? "Payment"
  return SCHEDULE_DESCRIPTION_FALLBACK[scheduleType] ?? scheduleType
}

// CurrencyInput requires `onChange` even when disabled; this placeholder
// keeps the read-only totals row from needing per-call wrappers.
const noopCurrencyChange = (_value: number | null) => {}

const PAYMENT_METHODS: PaymentMethod[] = [
  "bank_transfer",
  "credit_card",
  "debit_card",
  "cash",
  "cheque",
  "wallet",
  "direct_bill",
  "voucher",
  "other",
]

/**
 * Modal invoice creator scoped to a single booking. Operators can pick
 * between a free-form ("custom") invoice and one derived from an
 * unpaid payment schedule (amounts + due date are locked to the
 * schedule). Toggles control whether the new invoice is pushed to
 * SmartBill on issue, whether a fully-paid `payments` row is created
 * alongside it, and (when sync is off) lets the operator attach
 * supporting documents.
 */
export function BookingInvoiceDialog({
  open,
  onOpenChange,
  bookingId,
  defaultCurrency = "EUR", // i18n-literal-ok domain default currency
  defaultAmountCents = null,
  uploadFile,
  defaultScheduleTaxRatePercent = 0,
  resolveScheduleDueDate,
  onSuccess,
}: BookingInvoiceDialogProps) {
  const { createFromBooking } = useInvoiceMutation()
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const messages = useFinanceUiMessagesOrDefault()
  const dialog = messages.invoiceDialog

  const [invoiceType, setInvoiceType] = useState<InvoiceTypeChoice>("invoice")
  const [source, setSource] = useState<SourceChoice>("schedule")
  const [scheduleId, setScheduleId] = useState<string | null>(null)

  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [currency, setCurrency] = useState(defaultCurrency)
  const [subtotalCents, setSubtotalCents] = useState<number>(defaultAmountCents ?? 0)
  const [taxCents, setTaxCents] = useState<number>(0)
  const [totalCents, setTotalCents] = useState<number>(defaultAmountCents ?? 0)
  const [issueDate, setIssueDate] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [notes, setNotes] = useState("")
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([])

  const [syncToSmartbill, setSyncToSmartbill] = useState(true)
  const [markAsPaid, setMarkAsPaid] = useState(false)
  const [markAsPaidMethod, setMarkAsPaidMethod] = useState<PaymentMethod>("bank_transfer")
  const [markAsPaidDate, setMarkAsPaidDate] = useState("")

  const [attachments, setAttachments] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // ---- prefill / reset on open ---------------------------------------------
  useEffect(() => {
    if (!open) return
    const today = new Date().toISOString().split("T")[0] ?? ""
    setInvoiceType("invoice")
    setSource("schedule")
    setScheduleId(null)
    setInvoiceNumber(generateInvoiceNumber())
    setCurrency(defaultCurrency)
    setSubtotalCents(defaultAmountCents ?? 0)
    setTaxCents(0)
    setTotalCents(defaultAmountCents ?? 0)
    setIssueDate(today)
    setDueDate("")
    setNotes("")
    setLineItems([])
    setSyncToSmartbill(true)
    setMarkAsPaid(false)
    setMarkAsPaidMethod("bank_transfer")
    setMarkAsPaidDate(today)
    setAttachments([])
    setSubmitting(false)
    setError(null)
  }, [open, defaultCurrency, defaultAmountCents])

  // ---- schedules -----------------------------------------------------------
  const schedulesQuery = useBookingPaymentSchedules(bookingId, { enabled: open })
  const unpaidSchedules = useMemo(
    () =>
      (schedulesQuery.data?.data ?? []).filter((s) => s.status === "pending" || s.status === "due"),
    [schedulesQuery.data],
  )
  const scheduleLoadError = schedulesQuery.isError
    ? schedulesQuery.error instanceof Error
      ? schedulesQuery.error.message
      : dialog.scheduleLoadError
    : null

  useEffect(() => {
    if (!open || !schedulesQuery.isSuccess || unpaidSchedules.length > 0 || source !== "schedule") {
      return
    }
    setSource("custom")
    setScheduleId(null)
    setError(null)
  }, [open, schedulesQuery.isSuccess, unpaidSchedules.length, source])

  // When the operator picks a schedule, lock the financial fields to it.
  // `useMemo` keeps the lookup cheap on every render.
  const selectedSchedule = useMemo(
    () => (scheduleId ? (unpaidSchedules.find((s) => s.id === scheduleId) ?? null) : null),
    [scheduleId, unpaidSchedules],
  )

  useEffect(() => {
    if (source !== "schedule") {
      // Leaving the schedule branch — wipe the auto-prefilled line items
      // so the operator's blank "Custom" slate stays blank.
      setLineItems([])
      return
    }
    if (!selectedSchedule) {
      setLineItems([])
      return
    }
    setCurrency(selectedSchedule.currency)
    // The schedule amount is the gross (customer-facing) sum, so the
    // line item's net unit price is `amount / (1 + tax%)`. Without this
    // back-out the line would compute as `amount + amount * tax%`,
    // making the invoice exceed what the customer is actually paying.
    const taxFactor = 1 + Math.max(0, defaultScheduleTaxRatePercent) / 100
    const netUnitAmount =
      taxFactor > 0
        ? Math.round(selectedSchedule.amountCents / taxFactor)
        : selectedSchedule.amountCents
    setLineItems([
      {
        id: `schedule_${selectedSchedule.id}`,
        description: scheduleDescription(selectedSchedule.scheduleType),
        quantity: 1,
        unitAmountCents: netUnitAmount,
        taxRatePercent: defaultScheduleTaxRatePercent,
      },
    ])
  }, [source, selectedSchedule, defaultScheduleTaxRatePercent])

  useEffect(() => {
    if (source !== "schedule" || !selectedSchedule) return
    setDueDate(
      resolveScheduleDueDate?.({
        issueDate,
        dueDate: selectedSchedule.dueDate,
        invoiceType,
        booking: {
          id: bookingId,
          currency: defaultCurrency,
          amountCents: defaultAmountCents,
        },
        bookingPaymentSchedule: selectedSchedule,
      }) ?? selectedSchedule.dueDate,
    )
  }, [
    source,
    selectedSchedule,
    resolveScheduleDueDate,
    issueDate,
    invoiceType,
    bookingId,
    defaultCurrency,
    defaultAmountCents,
  ])

  // ---- line item totals ----------------------------------------------------
  // When the operator entered explicit line items, the global Subtotal/Tax/
  // Total fields become a read-only summary of the sum across rows.
  const lineItemTotals = useMemo(() => {
    let subtotal = 0
    let tax = 0
    for (const line of lineItems) {
      const lineSubtotal = Math.max(0, Math.round(line.quantity * line.unitAmountCents))
      const lineTax = Math.max(0, Math.round((lineSubtotal * line.taxRatePercent) / 100))
      subtotal += lineSubtotal
      tax += lineTax
    }
    return { subtotalCents: subtotal, taxCents: tax, totalCents: subtotal + tax }
  }, [lineItems])

  // Subtotal/Tax/Total are always derived from the line items, so reflect
  // the latest computation on every render (including the empty → 0 case).
  useEffect(() => {
    setSubtotalCents(lineItemTotals.subtotalCents)
    setTaxCents(lineItemTotals.taxCents)
    setTotalCents(lineItemTotals.totalCents)
  }, [lineItemTotals])

  const scheduleLocked = source === "schedule" && selectedSchedule != null
  const linesDriveTotals = source === "custom" && lineItems.length > 0

  // ---- submit --------------------------------------------------------------
  const submit = useCallback(async () => {
    if (submitting) return
    setError(null)

    if (source === "schedule" && scheduleLoadError) {
      setError(scheduleLoadError)
      return
    }
    if (source === "schedule" && !selectedSchedule) {
      setError(dialog.schedulePlaceholder)
      return
    }
    if (!issueDate) {
      setError(dialog.validation.issueDateRequired)
      return
    }
    if (!dueDate) {
      setError(dialog.validation.dueDateRequired)
      return
    }

    if (linesDriveTotals) {
      const invalid = lineItems.find((line) => !line.description.trim() || line.quantity < 1)
      if (invalid) {
        setError(dialog.validation.lineItemInvalid)
        return
      }
    }

    setSubmitting(true)
    try {
      // Subtotal/Tax/Total are intentionally omitted — the server
      // computes them from `lineItems` (custom mode) or from the linked
      // schedule (schedule mode). Sending the locally-derived numbers
      // can drift by 1 cent due to rounding and trips the strict
      // "Invoice tax does not match line items" cross-check.
      const created = await createFromBooking.mutateAsync({
        bookingId,
        bookingPaymentScheduleId: selectedSchedule?.id,
        invoiceNumber,
        issueDate,
        dueDate,
        currency,
        notes: notes || null,
        invoiceType,
        skipExternalSync: !syncToSmartbill,
        lineItems: linesDriveTotals
          ? lineItems.map((line) => ({
              description: line.description.trim(),
              quantity: line.quantity,
              unitAmountCents: line.unitAmountCents,
              taxRateBps:
                line.taxRatePercent > 0 ? Math.round(line.taxRatePercent * 100) : undefined,
            }))
          : undefined,
      })

      // Fully-paid sibling payment row. Use the totals returned by the
      // server (which may differ from the locally-derived ones by a cent
      // due to schedule tax back-out / rounding) — paying the local
      // figure can leave the invoice short and break the one-click
      // "Mark as paid" expectation (incl. proforma conversion triggers).
      if (markAsPaid && created.totalCents > 0) {
        const paymentDate = markAsPaidDate || new Date().toISOString().split("T")[0] || issueDate
        await fetcher(`${baseUrl}/v1/admin/finance/invoices/${created.id}/payments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amountCents: created.totalCents,
            currency: created.currency,
            paymentMethod: markAsPaidMethod,
            status: "completed",
            paymentDate,
          }),
        })
      }

      // Attachments: upload bytes via the template-supplied uploader,
      // then register each as an `invoice_attachment` row pointing at
      // the storage key returned by the upload.
      if (uploadFile && attachments.length > 0) {
        for (const file of attachments) {
          const uploaded = await uploadFile(file)
          await fetcher(`${baseUrl}/v1/admin/finance/invoices/${created.id}/attachments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              kind: "supporting_document",
              name: file.name,
              mimeType: uploaded.mimeType || file.type || null,
              fileSize: uploaded.fileSize ?? file.size,
              storageKey: uploaded.storageKey,
            }),
          })
        }
      }

      onSuccess?.(created)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }, [
    submitting,
    source,
    selectedSchedule,
    issueDate,
    dueDate,
    createFromBooking,
    bookingId,
    invoiceNumber,
    currency,
    notes,
    invoiceType,
    syncToSmartbill,
    markAsPaid,
    markAsPaidMethod,
    markAsPaidDate,
    attachments,
    uploadFile,
    baseUrl,
    fetcher,
    onSuccess,
    onOpenChange,
    linesDriveTotals,
    lineItems,
    dialog,
    scheduleLoadError,
  ])

  // ---- render --------------------------------------------------------------
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full! max-w-3xl! gap-0 p-0">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>{dialog.titles.create}</DialogTitle>
          <DialogDescription>{messages.invoicesPage.description}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto">
          <div className="flex flex-col gap-4 px-6 py-5">
            <div className="flex flex-col gap-2">
              <Label>{dialog.fields.type}</Label>
              <SegmentedChoice
                value={invoiceType}
                onChange={setInvoiceType}
                options={[
                  { value: "invoice", label: dialog.typeLabels.invoice },
                  { value: "proforma", label: dialog.typeLabels.proforma },
                ]}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>{dialog.fields.source}</Label>
              <SegmentedChoice
                value={source}
                onChange={(next) => {
                  clearError()
                  setSource(next)
                  if (next === "custom") setScheduleId(null)
                }}
                options={[
                  { value: "schedule", label: dialog.sourceLabels.schedule },
                  { value: "custom", label: dialog.sourceLabels.custom },
                ]}
              />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 px-4 py-3">
              <Label className="cursor-pointer" onClick={() => setSyncToSmartbill((v) => !v)}>
                {dialog.fields.syncToSmartbill}
              </Label>
              <Switch checked={syncToSmartbill} onCheckedChange={setSyncToSmartbill} />
            </div>

            {source === "schedule" ? (
              <div className="flex flex-col gap-2">
                <Label>{dialog.fields.schedule}</Label>
                <Select
                  value={scheduleId ?? undefined}
                  onValueChange={(v) => {
                    clearError()
                    setScheduleId(v ?? null)
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={dialog.schedulePlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {scheduleLoadError ? (
                      <div className="px-3 py-2 text-destructive text-sm">{scheduleLoadError}</div>
                    ) : unpaidSchedules.length === 0 ? (
                      <div className="px-3 py-2 text-muted-foreground text-sm">
                        {dialog.scheduleEmpty}
                      </div>
                    ) : (
                      unpaidSchedules.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {formatScheduleDate(s.dueDate, undefined)} ·{" "}
                          {formatMoney(s.amountCents, s.currency)}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {scheduleLocked ? (
                  <p className="text-xs text-muted-foreground">{dialog.scheduleLockedHint}</p>
                ) : null}
                {scheduleLoadError ? (
                  <p className="text-destructive text-xs">{dialog.scheduleLoadError}</p>
                ) : null}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{dialog.fields.invoiceNumber}</Label>
                <Input
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder={dialog.placeholders.invoiceNumber}
                  disabled={syncToSmartbill}
                />
                {syncToSmartbill ? (
                  <p className="text-xs text-muted-foreground">{dialog.invoiceNumberAutoHint}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialog.fields.currency}</Label>
                <CurrencyCombobox
                  value={currency}
                  onChange={(next) => setCurrency(next ?? defaultCurrency)}
                  disabled={scheduleLocked}
                />
              </div>
            </div>

            {source === "custom" || lineItems.length > 0 ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label>{dialog.lineItems.sectionTitle}</Label>
                  {source === "custom" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setLineItems((prev) => [
                          ...prev,
                          {
                            id: `tmp_${Date.now()}_${prev.length}`,
                            description: "",
                            quantity: 1,
                            unitAmountCents: 0,
                            taxRatePercent: 0,
                          },
                        ])
                      }
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      {dialog.lineItems.addRow}
                    </Button>
                  ) : null}
                </div>
                {lineItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{dialog.lineItems.empty}</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {lineItems.map((line, idx) => {
                      const lineSubtotal = Math.max(
                        0,
                        Math.round(line.quantity * line.unitAmountCents),
                      )
                      const lineTotal =
                        lineSubtotal +
                        Math.max(0, Math.round((lineSubtotal * line.taxRatePercent) / 100))
                      return (
                        <div
                          key={line.id}
                          className="grid grid-cols-[1fr_3rem_7rem_4rem_6rem_2rem] items-end gap-2 rounded-md border bg-background p-2"
                        >
                          <div className="flex flex-col gap-1">
                            {idx === 0 ? (
                              <Label className="text-xs">{dialog.lineItems.description}</Label>
                            ) : null}
                            <Input
                              value={line.description}
                              onChange={(e) =>
                                setLineItems((prev) =>
                                  prev.map((row, i) =>
                                    i === idx ? { ...row, description: e.target.value } : row,
                                  ),
                                )
                              }
                              disabled={scheduleLocked}
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            {idx === 0 ? (
                              <Label className="text-xs">{dialog.lineItems.quantity}</Label>
                            ) : null}
                            <Input
                              type="number"
                              min={1}
                              value={line.quantity}
                              onChange={(e) =>
                                setLineItems((prev) =>
                                  prev.map((row, i) =>
                                    i === idx
                                      ? {
                                          ...row,
                                          quantity: Math.max(1, Number(e.target.value) || 1),
                                        }
                                      : row,
                                  ),
                                )
                              }
                              disabled={scheduleLocked}
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            {idx === 0 ? (
                              <Label className="text-xs">{dialog.lineItems.unitPrice}</Label>
                            ) : null}
                            <CurrencyInput
                              value={line.unitAmountCents}
                              onChange={(next) =>
                                setLineItems((prev) =>
                                  prev.map((row, i) =>
                                    i === idx ? { ...row, unitAmountCents: next ?? 0 } : row,
                                  ),
                                )
                              }
                              currency={currency}
                              disabled={scheduleLocked}
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            {idx === 0 ? (
                              <Label className="text-xs">{dialog.lineItems.taxPercent}</Label>
                            ) : null}
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              step={0.01}
                              value={line.taxRatePercent}
                              onChange={(e) =>
                                setLineItems((prev) =>
                                  prev.map((row, i) =>
                                    i === idx
                                      ? {
                                          ...row,
                                          taxRatePercent: Math.max(
                                            0,
                                            Math.min(100, Number(e.target.value) || 0),
                                          ),
                                        }
                                      : row,
                                  ),
                                )
                              }
                              disabled={scheduleLocked}
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            {idx === 0 ? (
                              <Label className="text-xs">{dialog.lineItems.lineTotal}</Label>
                            ) : null}
                            <div className="px-2 py-1.5 text-right font-mono text-sm">
                              {formatMoney(lineTotal, currency)}
                            </div>
                          </div>
                          {scheduleLocked ? (
                            <div />
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={dialog.lineItems.remove}
                              onClick={() =>
                                setLineItems((prev) => prev.filter((_, i) => i !== idx))
                              }
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ) : null}

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{dialog.fields.subtotalCents}</Label>
                <CurrencyInput
                  value={subtotalCents}
                  onChange={noopCurrencyChange}
                  currency={currency}
                  disabled
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialog.fields.taxCents}</Label>
                <CurrencyInput
                  value={taxCents}
                  onChange={noopCurrencyChange}
                  currency={currency}
                  disabled
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialog.fields.totalCents}</Label>
                <CurrencyInput
                  value={totalCents}
                  onChange={noopCurrencyChange}
                  currency={currency}
                  disabled
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{dialog.fields.issueDate}</Label>
                <DatePicker
                  value={issueDate || null}
                  onChange={(next) => {
                    clearError()
                    setIssueDate(next ?? "")
                  }}
                  placeholder={dialog.placeholders.issueDate}
                  className="w-full"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialog.fields.dueDate}</Label>
                <DatePicker
                  value={dueDate || null}
                  onChange={(next) => {
                    clearError()
                    setDueDate(next ?? "")
                  }}
                  placeholder={dialog.placeholders.dueDate}
                  className="w-full"
                  disabled={scheduleLocked}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{dialog.fields.notes}</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={dialog.placeholders.notes}
              />
            </div>

            <div className="flex flex-col gap-3 rounded-md border bg-muted/20 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <Label className="cursor-pointer" onClick={() => setMarkAsPaid((v) => !v)}>
                  {dialog.fields.markAsPaid}
                </Label>
                <Switch checked={markAsPaid} onCheckedChange={setMarkAsPaid} />
              </div>

              {markAsPaid ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label>{dialog.fields.markAsPaidMethod}</Label>
                    <Select
                      value={markAsPaidMethod}
                      onValueChange={(v) =>
                        setMarkAsPaidMethod((v ?? "bank_transfer") as PaymentMethod)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((method) => (
                          <SelectItem key={method} value={method}>
                            {messages.common.paymentMethodLabels[method]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>{dialog.fields.markAsPaidDate}</Label>
                    <DatePicker
                      value={markAsPaidDate || null}
                      onChange={(next) => setMarkAsPaidDate(next ?? "")}
                      placeholder={dialog.placeholders.issueDate}
                      className="w-full"
                    />
                  </div>
                </div>
              ) : null}
            </div>

            {!syncToSmartbill && uploadFile ? (
              <div className="flex flex-col gap-2">
                <Label>{dialog.fields.attachments}</Label>
                <p className="text-xs text-muted-foreground">{dialog.attachmentsHint}</p>
                <input
                  type="file"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? [])
                    if (files.length > 0) setAttachments((prev) => [...prev, ...files])
                    e.target.value = ""
                  }}
                  className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-muted/70"
                />
                {attachments.length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {attachments.map((file, idx) => (
                      <li
                        // biome-ignore lint/suspicious/noArrayIndexKey: files in this picker session don't carry stable ids; name+index is the operator-visible identity -- owner: finance-react; existing suppression is intentional pending typed cleanup.
                        key={`${file.name}-${idx}`}
                        className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-1.5 text-sm"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{file.name}</span>
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {messages.common.cancel}
          </Button>
          <Button type="button" disabled={submitting} onClick={() => void submit()}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {dialog.actions.create}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SegmentedChoice<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (next: T) => void
  options: ReadonlyArray<{ value: T; label: string }>
}) {
  return (
    <div className="flex w-full rounded-md border bg-background p-0.5">
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={
              "flex-1 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors " +
              (active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")
            }
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
