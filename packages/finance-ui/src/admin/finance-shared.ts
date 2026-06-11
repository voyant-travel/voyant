// Shared bits of the packaged finance admin pages: status → badge-variant
// maps and the compact amount/method formatters the operator-grade detail
// pages use. Kept admin-local — the canonical `InvoiceDetailPage` in
// `../components` exports its own variants for the embeddable surface.

export type {
  CreditNoteRecord as CreditNoteRow,
  FinanceNoteRecord as FinanceNote,
  InvoiceRecord as InvoiceDetail,
  LineItemRecord as LineItem,
  PaymentRecord as PaymentRow,
} from "@voyantjs/finance-react"

export const invoiceStatusVariant: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  draft: "outline",
  pending_external_allocation: "outline",
  issued: "secondary",
  partially_paid: "secondary",
  paid: "default",
  overdue: "destructive",
  void: "destructive",
}

export const paymentStatusVariant: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  pending: "outline",
  completed: "default",
  failed: "destructive",
  refunded: "secondary",
}

export const creditNoteStatusVariant: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  draft: "outline",
  issued: "default",
  applied: "secondary",
}

export function formatAmount(cents: number, currency: string): string {
  return `${(cents / 100).toFixed(2)} ${currency}`
}

export function formatMethod(method: string): string {
  return method.replace(/_/g, " ")
}
