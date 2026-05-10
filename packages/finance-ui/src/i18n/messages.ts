import type { InvoiceRecord, SupplierPaymentRecord } from "@voyantjs/finance-react"

export const invoiceStatuses = [
  "draft",
  "sent",
  "partially_paid",
  "paid",
  "overdue",
  "void",
] as const

export const supplierPaymentMethods = [
  "bank_transfer",
  "credit_card",
  "cash",
  "cheque",
  "other",
] as const

export const paymentMethods = [
  "bank_transfer",
  "credit_card",
  "debit_card",
  "cash",
  "cheque",
  "wallet",
  "direct_bill",
  "voucher",
  "other",
] as const

export const supplierPaymentStatuses = ["pending", "completed", "failed", "refunded"] as const

export type InvoiceStatus = InvoiceRecord["status"]
export type PaymentMethod = (typeof paymentMethods)[number]
export type SupplierPaymentMethod = (typeof supplierPaymentMethods)[number]
export type SupplierPaymentStatus = SupplierPaymentRecord["status"]

export type FinanceUiMessages = {
  common: {
    cancel: string
    saveChanges: string
    invoiceStatusLabels: Record<InvoiceStatus, string>
    paymentMethodLabels: Record<PaymentMethod, string>
    supplierPaymentMethodLabels: Record<SupplierPaymentMethod, string>
    supplierPaymentStatusLabels: Record<SupplierPaymentStatus, string>
  }
  invoiceDialog: {
    titles: {
      create: string
      edit: string
    }
    fields: {
      invoiceNumber: string
      status: string
      bookingId: string
      currency: string
      subtotalCents: string
      taxCents: string
      totalCents: string
      issueDate: string
      dueDate: string
      notes: string
    }
    placeholders: {
      invoiceNumber: string
      bookingId: string
      issueDate: string
      dueDate: string
      notes: string
    }
    actions: {
      create: string
    }
    validation: {
      invoiceNumberRequired: string
      bookingIdRequired: string
      currencyIsoCode: string
      issueDateRequired: string
      dueDateRequired: string
    }
  }
  invoicesPage: {
    title: string
    description: string
    searchPlaceholder: string
    actions: {
      newInvoice: string
    }
    filters: {
      button: string
      statusLabel: string
      statusAll: string
      currencyLabel: string
      currencyAny: string
      dueDateLabel: string
      dateAny: string
      clear: string
    }
    columns: {
      invoiceNumber: string
      status: string
      total: string
      paid: string
      balanceDue: string
      dueDate: string
    }
    empty: string
    loadFailed: string
    pagination: {
      showing: string
      page: string
      previous: string
      next: string
    }
  }
  paymentsPage: {
    title: string
    description: string
    searchPlaceholder: string
    actions: {
      recordPayment: string
    }
    kindLabels: {
      customer: string
      supplier: string
    }
    filters: {
      button: string
      kindLabel: string
      kindAll: string
      statusLabel: string
      statusAll: string
      methodLabel: string
      methodAll: string
      supplierLabel: string
      supplierAny: string
      supplierEmpty: string
      currencyLabel: string
      currencyAny: string
      paymentDateLabel: string
      dateAny: string
      clear: string
    }
    columns: {
      kind: string
      reference: string
      party: string
      amount: string
      status: string
      date: string
      method: string
    }
    noValue: string
    empty: string
    loadFailed: string
    pagination: {
      showing: string
      page: string
      previous: string
      next: string
    }
  }
  supplierPaymentDialog: {
    title: string
    fields: {
      bookingId: string
      supplierId: string
      amountCents: string
      currency: string
      paymentDate: string
      paymentMethod: string
      status: string
      referenceNumber: string
      notes: string
    }
    placeholders: {
      bookingId: string
      supplierId: string
      paymentDate: string
      referenceNumber: string
      notes: string
    }
    actions: {
      create: string
    }
    validation: {
      bookingIdRequired: string
      amountMinimum: string
      paymentDateRequired: string
    }
  }
}
