import { z } from "zod"
import {
  accountantInvoiceRecordSchema,
  accountantShareCreatedSchema,
  accountantShareRecordSchema,
  accountantSummarySchema,
  costCategoryRecordSchema,
} from "./accountant.js"
import { arrayEnvelope, paginatedEnvelope, singleEnvelope } from "./common.js"
import {
  creditNoteRecordSchema,
  financeNoteRecordSchema,
  invoiceAttachmentRecordSchema,
  invoiceNumberSeriesRecordSchema,
  invoiceRecordSchema,
  lineItemRecordSchema,
  paymentRecordSchema,
  supplierPaymentRecordSchema,
  unifiedPaymentRecordSchema,
} from "./invoice.js"
import {
  supplierInvoiceAttachmentRecordSchema,
  supplierInvoiceDetailRecordSchema,
  supplierInvoiceRecordSchema,
} from "./supplier.js"

export const costCategoriesResponse = arrayEnvelope(costCategoryRecordSchema)
export const costCategorySingleResponse = singleEnvelope(costCategoryRecordSchema)

export const accountantSharesResponse = arrayEnvelope(accountantShareRecordSchema)
export const accountantShareCreatedResponse = singleEnvelope(accountantShareCreatedSchema)
export const accountantShareRevokedResponse = singleEnvelope(z.object({ id: z.string() }))
export const accountantSummaryResponse = singleEnvelope(accountantSummarySchema)
export const accountantInvoicesResponse = arrayEnvelope(accountantInvoiceRecordSchema)

export const supplierInvoiceListResponse = paginatedEnvelope(supplierInvoiceRecordSchema)
export const supplierInvoiceSingleResponse = singleEnvelope(supplierInvoiceDetailRecordSchema)
export const supplierInvoiceAttachmentsResponse = arrayEnvelope(
  supplierInvoiceAttachmentRecordSchema,
)

export const invoiceListResponse = paginatedEnvelope(invoiceRecordSchema)
export const invoiceNumberSeriesListResponse = paginatedEnvelope(invoiceNumberSeriesRecordSchema)
export const invoiceNumberSeriesSingleResponse = singleEnvelope(invoiceNumberSeriesRecordSchema)
export const supplierPaymentListResponse = paginatedEnvelope(supplierPaymentRecordSchema)
export const allPaymentsListResponse = paginatedEnvelope(unifiedPaymentRecordSchema)
export const paymentSingleResponse = singleEnvelope(unifiedPaymentRecordSchema)
export const invoiceSingleResponse = singleEnvelope(invoiceRecordSchema)
export const invoiceLineItemsResponse = arrayEnvelope(lineItemRecordSchema)
export const invoicePaymentsResponse = arrayEnvelope(paymentRecordSchema)
export const invoiceCreditNotesResponse = arrayEnvelope(creditNoteRecordSchema)
export const invoiceNotesResponse = arrayEnvelope(financeNoteRecordSchema)
export const invoiceAttachmentsResponse = arrayEnvelope(invoiceAttachmentRecordSchema)
