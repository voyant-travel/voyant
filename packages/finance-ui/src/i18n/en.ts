import type { FinanceUiMessages } from "./messages.js"

export const financeUiEn = {
  common: {
    cancel: "Cancel",
    saveChanges: "Save Changes",
    invoiceStatusLabels: {
      draft: "Draft",
      sent: "Sent",
      partially_paid: "Partially Paid",
      paid: "Paid",
      overdue: "Overdue",
      void: "Void",
    },
    supplierPaymentMethodLabels: {
      bank_transfer: "Bank Transfer",
      credit_card: "Credit Card",
      cash: "Cash",
      cheque: "Cheque",
      other: "Other",
    },
    supplierPaymentStatusLabels: {
      pending: "Pending",
      completed: "Completed",
      failed: "Failed",
      refunded: "Refunded",
    },
  },
  invoiceDialog: {
    titles: {
      create: "New Invoice",
      edit: "Edit Invoice",
    },
    fields: {
      invoiceNumber: "Invoice Number",
      status: "Status",
      bookingId: "Booking ID",
      currency: "Currency",
      subtotalCents: "Subtotal (cents)",
      taxCents: "Tax (cents)",
      totalCents: "Total (cents)",
      issueDate: "Issue Date",
      dueDate: "Due Date",
      notes: "Notes",
    },
    placeholders: {
      invoiceNumber: "INV-2025-1234",
      bookingId: "book_...",
      issueDate: "Pick issue date",
      dueDate: "Pick due date",
      notes: "Invoice notes...",
    },
    actions: {
      create: "Create Invoice",
    },
    validation: {
      invoiceNumberRequired: "Invoice number is required",
      bookingIdRequired: "Booking ID is required",
      currencyIsoCode: "Use 3-letter ISO code",
      issueDateRequired: "Issue date is required",
      dueDateRequired: "Due date is required",
    },
  },
  supplierPaymentDialog: {
    title: "Record Supplier Payment",
    fields: {
      bookingId: "Booking ID",
      supplierId: "Supplier ID (optional)",
      amountCents: "Amount (cents)",
      currency: "Currency",
      paymentDate: "Payment Date",
      paymentMethod: "Payment Method",
      status: "Status",
      referenceNumber: "Reference Number",
      notes: "Notes",
    },
    placeholders: {
      bookingId: "book_...",
      supplierId: "supp_...",
      paymentDate: "Select payment date",
      referenceNumber: "TXN-12345",
      notes: "Payment notes...",
    },
    actions: {
      create: "Record Payment",
    },
    validation: {
      bookingIdRequired: "Booking ID is required",
      amountMinimum: "Amount must be at least 1",
      paymentDateRequired: "Payment date is required",
    },
  },
} satisfies FinanceUiMessages
