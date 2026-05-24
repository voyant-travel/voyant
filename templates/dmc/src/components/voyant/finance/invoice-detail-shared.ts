export type {
  CreditNoteRecord as CreditNoteRow,
  FinanceNoteRecord as FinanceNote,
  InvoiceRecord as InvoiceDetail,
  LineItemRecord as LineItem,
  PaymentRecord as PaymentRow,
} from "@voyantjs/finance-react"

export {
  creditNoteStatusVariant,
  formatAmount,
  formatMethod,
  formatStatus,
  paymentStatusVariant,
} from "./finance-shared"

export const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  issued: "secondary",
  partially_paid: "secondary",
  paid: "default",
  overdue: "destructive",
  void: "destructive",
}
