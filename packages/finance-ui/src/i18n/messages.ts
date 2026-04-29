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

export const supplierPaymentStatuses = ["pending", "completed", "failed", "refunded"] as const

export type InvoiceStatus = InvoiceRecord["status"]
export type SupplierPaymentMethod = (typeof supplierPaymentMethods)[number]
export type SupplierPaymentStatus = SupplierPaymentRecord["status"]

export type FinanceUiMessages = {
  common: {
    cancel: string
    saveChanges: string
    invoiceStatusLabels: Record<InvoiceStatus, string>
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
