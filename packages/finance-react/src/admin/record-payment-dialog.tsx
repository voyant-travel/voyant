"use client"

import { type OperatorAdminMessages, useOperatorAdminMessages } from "@voyant-travel/admin"
import { type BookingRecord, useBookings } from "@voyant-travel/bookings-react"
import { type Supplier, useSuppliers } from "@voyant-travel/distribution-react/suppliers"
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Textarea,
} from "@voyant-travel/ui/components"
import { AsyncCombobox } from "@voyant-travel/ui/components/async-combobox"
import { CurrencyCombobox } from "@voyant-travel/ui/components/currency-combobox"
import { DatePicker } from "@voyant-travel/ui/components/date-picker"
import { Loader2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import {
  type FinancePaymentKind,
  type InvoiceRecord,
  useInvoicePaymentMutation,
  useInvoices,
  useSupplierPaymentMutation,
} from "../index.js"

const PAYMENT_METHODS = ["bank_transfer", "credit_card", "cash", "cheque", "other"] as const

const PAYMENT_STATUSES = ["pending", "completed", "failed", "refunded"] as const

type PaymentMethod = (typeof PAYMENT_METHODS)[number]
type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

interface FormState {
  amountCents: string
  currency: string
  baseAmountCents: string
  paymentMethod: PaymentMethod
  status: PaymentStatus
  paymentDate: string
  referenceNumber: string
  notes: string
}

const todayIso = () => new Date().toISOString().split("T")[0]!

const initialState = (): FormState => ({
  amountCents: "",
  currency: "EUR",
  baseAmountCents: "",
  paymentMethod: "bank_transfer",
  status: "completed",
  paymentDate: todayIso(),
  referenceNumber: "",
  notes: "",
})

function getMethodLabel(messages: OperatorAdminMessages, method: string) {
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
      return method
  }
}

function getStatusLabel(messages: OperatorAdminMessages, status: string) {
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
      return status
  }
}

export interface RecordPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Default kind when the dialog opens. Defaults to `customer`. */
  defaultKind?: FinancePaymentKind
  onSuccess?: () => void
}

/**
 * Packaged record-payment dialog for the finance payments page: picks an
 * invoice (customer payments) or a booking + supplier (supplier payments) via
 * the shared react-data packages (`finance-react`, `bookings-react`,
 * `suppliers-react`) — no app-local query clients.
 */
export function RecordPaymentDialog({
  open,
  onOpenChange,
  defaultKind = "customer",
  onSuccess,
}: RecordPaymentDialogProps) {
  const messages = useOperatorAdminMessages()
  const f = messages.finance
  const dialog = f.recordPaymentDialog

  const [kind, setKind] = useState<FinancePaymentKind>(defaultKind)
  const [form, setForm] = useState<FormState>(initialState)

  const [invoiceId, setInvoiceId] = useState<string | null>(null)
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null)
  const [invoiceSearch, setInvoiceSearch] = useState("")

  const [bookingId, setBookingId] = useState<string | null>(null)
  const [selectedBooking, setSelectedBooking] = useState<BookingRecord | null>(null)
  const [bookingSearch, setBookingSearch] = useState("")
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [supplierSearch, setSupplierSearch] = useState("")

  const [error, setError] = useState<string | null>(null)

  const customerMutation = useInvoicePaymentMutation(invoiceId ?? "")
  const supplierMutation = useSupplierPaymentMutation()

  // Reset whenever the dialog reopens — avoids leaking the previous
  // submission into a fresh entry.
  useEffect(() => {
    if (open) {
      setKind(defaultKind)
      setForm(initialState())
      setInvoiceId(null)
      setSelectedInvoice(null)
      setInvoiceSearch("")
      setBookingId(null)
      setSelectedBooking(null)
      setBookingSearch("")
      setSupplierId(null)
      setSelectedSupplier(null)
      setSupplierSearch("")
      setError(null)
    }
  }, [open, defaultKind])

  // When an invoice is picked we mirror its currency into the form so the
  // operator doesn't have to pick it again — that's the whole reason the
  // server stores currency on the invoice in the first place.
  useEffect(() => {
    if (selectedInvoice) {
      setForm((prev) => ({ ...prev, currency: selectedInvoice.currency, baseAmountCents: "" }))
    }
  }, [selectedInvoice])

  const invoicesQuery = useInvoices({
    search: invoiceSearch || undefined,
    limit: 20,
    enabled: kind === "customer",
  })
  const invoiceOptions = useMemo(() => invoicesQuery.data?.data ?? [], [invoicesQuery.data])

  const bookingsQuery = useBookings({
    search: bookingSearch || undefined,
    limit: 20,
    enabled: kind === "supplier",
  })
  const bookingOptions = useMemo(() => bookingsQuery.data?.data ?? [], [bookingsQuery.data])

  const suppliersQuery = useSuppliers({ search: supplierSearch || undefined, limit: 20 })
  const supplierOptions = suppliersQuery.data?.data ?? []

  const isSubmitting =
    (kind === "customer" && customerMutation.isPending) ||
    (kind === "supplier" && supplierMutation.create.isPending)

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const baseCurrency =
    kind === "customer" ? selectedInvoice?.currency : (selectedBooking?.sellCurrency ?? null)
  const normalizedPaymentCurrency = form.currency.trim().toUpperCase()
  const normalizedBaseCurrency = baseCurrency?.trim().toUpperCase() ?? null
  const requiresBaseAmount =
    normalizedBaseCurrency !== null &&
    normalizedPaymentCurrency !== "" &&
    normalizedPaymentCurrency !== normalizedBaseCurrency

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    const amountCents = Number.parseInt(form.amountCents, 10)
    if (!Number.isFinite(amountCents) || amountCents < 1) {
      setError(f.paymentDialog.validationAmountMin)
      return
    }
    if (!form.paymentDate) {
      setError(f.paymentDialog.validationPaymentDateRequired)
      return
    }

    let baseAmountCents: number | null = null
    if (requiresBaseAmount) {
      const parsedBaseAmountCents = Number.parseInt(form.baseAmountCents, 10)
      if (!Number.isFinite(parsedBaseAmountCents) || parsedBaseAmountCents < 1) {
        setError(f.paymentDialog.validationBaseAmountRequired)
        return
      }
      baseAmountCents = parsedBaseAmountCents
    }

    if (kind === "customer") {
      if (!invoiceId) {
        setError(dialog.invoiceRequired)
        return
      }
      await customerMutation.mutateAsync({
        amountCents,
        currency: normalizedPaymentCurrency,
        baseCurrency: requiresBaseAmount ? normalizedBaseCurrency : null,
        baseAmountCents: requiresBaseAmount ? baseAmountCents : null,
        paymentMethod: form.paymentMethod,
        status: form.status,
        referenceNumber: form.referenceNumber || null,
        paymentDate: form.paymentDate,
        notes: form.notes || null,
      })
    } else {
      if (!bookingId) {
        setError(dialog.bookingRequired)
        return
      }
      await supplierMutation.create.mutateAsync({
        bookingId,
        supplierId: supplierId ?? null,
        amountCents,
        currency: normalizedPaymentCurrency,
        baseCurrency: requiresBaseAmount ? normalizedBaseCurrency : null,
        baseAmountCents: requiresBaseAmount ? baseAmountCents : null,
        paymentMethod: form.paymentMethod,
        status: form.status,
        referenceNumber: form.referenceNumber || null,
        paymentDate: form.paymentDate,
        notes: form.notes || null,
      })
    }

    onOpenChange(false)
    onSuccess?.()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="lg">
        <SheetHeader>
          <SheetTitle>{dialog.title}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <SheetBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>{dialog.kindLabel}</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={kind === "customer" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setKind("customer")}
                >
                  {dialog.kindCustomer}
                </Button>
                <Button
                  type="button"
                  variant={kind === "supplier" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setKind("supplier")}
                >
                  {dialog.kindSupplier}
                </Button>
              </div>
            </div>

            {kind === "customer" ? (
              <div className="flex flex-col gap-2">
                <Label>{dialog.invoiceLabel}</Label>
                <AsyncCombobox<InvoiceRecord>
                  value={invoiceId}
                  onChange={(value) => {
                    setInvoiceId(value)
                    if (!value) setSelectedInvoice(null)
                    else {
                      const match = invoiceOptions.find((inv) => inv.id === value)
                      if (match) setSelectedInvoice(match)
                    }
                  }}
                  items={invoiceOptions}
                  selectedItem={selectedInvoice}
                  getKey={(inv) => inv.id}
                  getLabel={(inv) => inv.invoiceNumber}
                  getSecondary={(inv) =>
                    `${(inv.totalCents / 100).toFixed(2)} ${inv.currency} · ${inv.status}`
                  }
                  onSearchChange={setInvoiceSearch}
                  placeholder={dialog.invoicePlaceholder}
                  emptyText={dialog.invoiceEmpty}
                  triggerClassName="w-full"
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>{dialog.bookingLabel}</Label>
                  <AsyncCombobox<BookingRecord>
                    value={bookingId}
                    onChange={(value) => {
                      setBookingId(value)
                      if (!value) setSelectedBooking(null)
                      else {
                        const match = bookingOptions.find((b) => b.id === value)
                        if (match) setSelectedBooking(match)
                      }
                    }}
                    items={bookingOptions}
                    selectedItem={selectedBooking}
                    getKey={(b) => b.id}
                    getLabel={(b) => b.bookingNumber}
                    getSecondary={(b) => b.status}
                    onSearchChange={setBookingSearch}
                    placeholder={dialog.bookingPlaceholder}
                    emptyText={dialog.bookingEmpty}
                    triggerClassName="w-full"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>{dialog.supplierLabel}</Label>
                  <AsyncCombobox<Supplier>
                    value={supplierId}
                    onChange={(value) => {
                      setSupplierId(value)
                      if (!value) setSelectedSupplier(null)
                      else {
                        const match = supplierOptions.find((s) => s.id === value)
                        if (match) setSelectedSupplier(match)
                      }
                    }}
                    items={supplierOptions}
                    selectedItem={selectedSupplier}
                    getKey={(s) => s.id}
                    getLabel={(s) => s.name}
                    onSearchChange={setSupplierSearch}
                    placeholder={dialog.supplierPlaceholder}
                    emptyText={dialog.supplierEmpty}
                    triggerClassName="w-full"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{f.paymentDialog.amountLabel}</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.amountCents}
                  onChange={(e) => setField("amountCents", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{f.paymentDialog.currencyLabel}</Label>
                <CurrencyCombobox
                  value={form.currency || null}
                  onChange={(next) => setField("currency", next ?? "EUR")}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{f.paymentDialog.paymentDateLabel}</Label>
                <DatePicker
                  value={form.paymentDate || null}
                  onChange={(next) => setField("paymentDate", next ?? "")}
                  className="w-full"
                />
              </div>
            </div>

            {requiresBaseAmount ? (
              <div className="rounded-md border bg-muted/20 p-3">
                <div className="mb-3">
                  <h3 className="text-sm font-medium">{f.paymentDialog.fxSectionTitle}</h3>
                  <p className="text-muted-foreground text-xs">
                    {f.paymentDialog.baseCurrencyHelp}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label>{f.paymentDialog.baseAmountLabel}</Label>
                    <Input
                      type="number"
                      min="1"
                      value={form.baseAmountCents}
                      onChange={(e) => setField("baseAmountCents", e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>{f.paymentDialog.currencyLabel}</Label>
                    <Input value={normalizedBaseCurrency ?? ""} readOnly className="uppercase" />
                  </div>
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{f.paymentDialog.paymentMethodLabel}</Label>
                <Select
                  value={form.paymentMethod}
                  onValueChange={(value) => setField("paymentMethod", value as PaymentMethod)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {getMethodLabel(messages, m)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{f.paymentDialog.statusLabel}</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) => setField("status", value as PaymentStatus)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {getStatusLabel(messages, s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{f.paymentDialog.referenceNumberLabel}</Label>
                <Input
                  value={form.referenceNumber}
                  onChange={(e) => setField("referenceNumber", e.target.value)}
                  placeholder={f.paymentDialog.referenceNumberPlaceholder}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{f.paymentDialog.notesLabel}</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                placeholder={f.paymentDialog.notesPlaceholder}
              />
            </div>

            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {f.paymentDialog.cancel}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {f.paymentDialog.submit}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
