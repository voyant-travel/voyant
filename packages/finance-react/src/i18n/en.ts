import { common, invoiceDetailPage, invoiceDialog, invoicesPage } from "./en/invoices.js"
import {
  invoiceNumberSeriesDialog,
  invoiceNumberSeriesPage,
  paymentDetailPage,
  paymentPolicy,
  paymentsPage,
  recordBookingPaymentDialog,
  taxesPage,
} from "./en/numberingAndPayments.js"
import { costCategories, profitability } from "./en/profitability.js"
import {
  supplierInvoiceDetail,
  supplierInvoicesPage,
  supplierPaymentDialog,
} from "./en/suppliers.js"
import type { FinanceUiMessages } from "./messages.js"

export const financeUiEn = {
  common,
  invoiceDialog,
  invoicesPage,
  supplierInvoicesPage,
  supplierInvoiceDetail,
  invoiceNumberSeriesPage,
  invoiceNumberSeriesDialog,
  paymentsPage,
  paymentDetailPage,
  invoiceDetailPage,
  paymentPolicy,
  taxesPage,
  supplierPaymentDialog,
  recordBookingPaymentDialog,
  profitability,
  costCategories,
} satisfies FinanceUiMessages
