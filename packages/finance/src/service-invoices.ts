import { financeInvoiceCoreService } from "./service-invoice-core.js"
import { financeInvoiceCreditNoteService } from "./service-invoice-credit-notes.js"
import { financeInvoiceFromBookingService } from "./service-invoice-from-booking.js"
import { financeInvoiceLineItemService } from "./service-invoice-line-items.js"
import { financeInvoicePaymentService } from "./service-invoice-payments.js"

export const financeInvoiceService = {
  ...financeInvoiceCoreService,
  ...financeInvoiceFromBookingService,
  ...financeInvoiceLineItemService,
  ...financeInvoicePaymentService,
  ...financeInvoiceCreditNoteService,
}
