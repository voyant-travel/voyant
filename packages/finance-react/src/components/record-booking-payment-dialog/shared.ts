import {
  type PaymentMethod,
  type PaymentStatus,
  paymentMethodSchema,
  paymentStatusSchema,
} from "../../index.js"

export const PAYMENT_METHODS = paymentMethodSchema.options
export const PAYMENT_STATUSES = paymentStatusSchema.options

export interface EditingPaymentSnapshot {
  id: string
  invoiceId: string
  amountCents: number
  currency: string
  baseCurrency: string | null
  baseAmountCents: number | null
  paymentMethod: PaymentMethod
  status: PaymentStatus
  paymentDate: string
  referenceNumber: string | null
  notes: string | null
}

export interface RecordBookingPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: string
  /** Pre-fill currency when no invoices have loaded yet. */
  defaultCurrency?: string
  onRecorded?: () => void
  /**
   * When set, the dialog runs in edit mode: it prefills from the
   * snapshot and PATCHes `/v1/admin/finance/payments/:id` on submit instead
   * of POSTing a new payment. The invoice selector is locked because
   * reassigning a payment to a different invoice is out of scope for
   * this dialog.
   */
  editingPayment?: EditingPaymentSnapshot | null
}

export interface FormState {
  invoiceId: string
  amountCents: number
  currency: string
  fxRate: string
  fxOverride: boolean
  paymentMethod: PaymentMethod
  status: PaymentStatus
  paymentDate: string
  referenceNumber: string
  notes: string
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function buildInitialFormState(currency: string): FormState {
  return {
    invoiceId: "",
    amountCents: 0,
    currency,
    fxRate: "",
    fxOverride: false,
    paymentMethod: "bank_transfer",
    status: "completed",
    paymentDate: todayIso(),
    referenceNumber: "",
    notes: "",
  }
}

export function formatAmount(cents: number): string {
  return (cents / 100).toFixed(2)
}

export function normalizeCurrency(currency: string | null | undefined): string {
  return currency?.trim().toUpperCase() ?? ""
}

export function parseFxRate(raw: string): number | null {
  const normalized = raw.trim().replace(",", ".")
  if (!normalized) return null
  const value = Number.parseFloat(normalized)
  return Number.isFinite(value) && value > 0 ? value : null
}

export function deriveBaseAmountCents(amountCents: number, fxRate: number | null): number | null {
  if (!fxRate || amountCents <= 0) return null
  return Math.round(amountCents / fxRate)
}

export function formatFxRateInput(rate: number): string {
  return rate.toFixed(4)
}

export function formatRateDisplay(rate: number): string {
  return rate.toFixed(4)
}

export function formatCommissionPercent(bps: number): string {
  return (bps / 100).toFixed(2)
}
