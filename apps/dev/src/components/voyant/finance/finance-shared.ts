export type {
  CreditNoteRecord as CreditNoteRow,
  FinanceNoteRecord as FinanceNote,
  InvoiceRecord as InvoiceDetail,
  InvoiceRecord as InvoiceRow,
  LineItemRecord as LineItem,
  PaymentRecord as PaymentRow,
  SupplierPaymentRecord as SupplierPaymentRow,
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

export function formatStatus(status: string): string {
  return status.replace(/_/g, " ")
}

export function formatMethod(method: string): string {
  return method.replace(/_/g, " ")
}
