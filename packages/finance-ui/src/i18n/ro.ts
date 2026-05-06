import type { FinanceUiMessages } from "./messages.js"

export const financeUiRo = {
  common: {
    cancel: "Anuleaza",
    saveChanges: "Salveaza Modificarile",
    invoiceStatusLabels: {
      draft: "Ciorna",
      sent: "Trimisa",
      partially_paid: "Platita Partial",
      paid: "Platita",
      overdue: "Scadenta Depasita",
      void: "Anulata",
    },
    supplierPaymentMethodLabels: {
      bank_transfer: "Transfer Bancar",
      credit_card: "Card de Credit",
      cash: "Numerar",
      cheque: "Cec",
      other: "Altul",
    },
    supplierPaymentStatusLabels: {
      pending: "In asteptare",
      completed: "Finalizata",
      failed: "Esuata",
      refunded: "Rambursata",
    },
  },
  invoiceDialog: {
    titles: {
      create: "Factura Noua",
      edit: "Editeaza Factura",
    },
    fields: {
      invoiceNumber: "Numar Factura",
      status: "Status",
      bookingId: "ID Rezervare",
      currency: "Moneda",
      subtotalCents: "Subtotal (centi)",
      taxCents: "Taxa (centi)",
      totalCents: "Total (centi)",
      issueDate: "Data Emiterii",
      dueDate: "Data Scadentei",
      notes: "Note",
    },
    placeholders: {
      invoiceNumber: "INV-2025-1234",
      bookingId: "book_...",
      issueDate: "Alege data emiterii",
      dueDate: "Alege data scadentei",
      notes: "Note factura...",
    },
    actions: {
      create: "Creeaza Factura",
    },
    validation: {
      invoiceNumberRequired: "Numarul facturii este obligatoriu",
      bookingIdRequired: "ID-ul rezervarii este obligatoriu",
      currencyIsoCode: "Foloseste cod ISO din 3 litere",
      issueDateRequired: "Data emiterii este obligatorie",
      dueDateRequired: "Data scadentei este obligatorie",
    },
  },
  supplierPaymentDialog: {
    title: "Inregistreaza Plata Furnizorului",
    fields: {
      bookingId: "ID Rezervare",
      supplierId: "ID Furnizor (optional)",
      amountCents: "Suma (centi)",
      currency: "Moneda",
      paymentDate: "Data Platii",
      paymentMethod: "Metoda de Plata",
      status: "Status",
      referenceNumber: "Numar Referinta",
      notes: "Note",
    },
    placeholders: {
      bookingId: "book_...",
      supplierId: "supp_...",
      paymentDate: "Selecteaza data platii",
      referenceNumber: "TXN-12345",
      notes: "Note plata...",
    },
    actions: {
      create: "Inregistreaza Plata",
    },
    validation: {
      bookingIdRequired: "ID-ul rezervarii este obligatoriu",
      amountMinimum: "Suma trebuie sa fie cel putin 1",
      paymentDateRequired: "Data platii este obligatorie",
    },
  },
} satisfies FinanceUiMessages
