import { relations } from "drizzle-orm"

import {
  bookingGuarantees,
  bookingItemCommissions,
  bookingItemTaxLines,
  bookingPaymentSchedules,
} from "./booking-billing.js"
import {
  financeNotes,
  invoiceAttachments,
  invoiceExternalRefs,
  invoiceNumberSeries,
  invoiceRenditions,
  invoiceTemplates,
} from "./invoice-documents.js"
import { paymentInstruments } from "./payment-instruments.js"
import { paymentAuthorizations, paymentCaptures } from "./payment-processing.js"
import {
  creditNoteLineItems,
  creditNotes,
  invoiceLineItems,
  invoices,
  payments,
} from "./receivables.js"
import { supplierPayments } from "./supplier-invoices.js"
import { taxRegimes } from "./tax.js"
import { travelCreditRedemptions, travelCredits } from "./travel-credits.js"

// ---------- relations ----------

export const invoicesRelations = relations(invoices, ({ many }) => ({
  lineItems: many(invoiceLineItems),
  payments: many(payments),
  creditNotes: many(creditNotes),
  notes: many(financeNotes),
  authorizations: many(paymentAuthorizations),
  captures: many(paymentCaptures),
  renditions: many(invoiceRenditions),
  attachments: many(invoiceAttachments),
}))

export const paymentInstrumentsRelations = relations(paymentInstruments, ({ many }) => ({
  guarantees: many(bookingGuarantees),
  payments: many(payments),
  supplierPayments: many(supplierPayments),
  authorizations: many(paymentAuthorizations),
}))

export const paymentAuthorizationsRelations = relations(paymentAuthorizations, ({ one, many }) => ({
  invoice: one(invoices, {
    fields: [paymentAuthorizations.invoiceId],
    references: [invoices.id],
  }),
  paymentInstrument: one(paymentInstruments, {
    fields: [paymentAuthorizations.paymentInstrumentId],
    references: [paymentInstruments.id],
  }),
  bookingGuarantee: one(bookingGuarantees, {
    fields: [paymentAuthorizations.bookingGuaranteeId],
    references: [bookingGuarantees.id],
    relationName: "guarantee_authorization",
  }),
  captures: many(paymentCaptures),
  payments: many(payments),
}))

export const paymentCapturesRelations = relations(paymentCaptures, ({ one, many }) => ({
  paymentAuthorization: one(paymentAuthorizations, {
    fields: [paymentCaptures.paymentAuthorizationId],
    references: [paymentAuthorizations.id],
  }),
  invoice: one(invoices, {
    fields: [paymentCaptures.invoiceId],
    references: [invoices.id],
  }),
  payments: many(payments),
}))

export const bookingPaymentSchedulesRelations = relations(bookingPaymentSchedules, ({ many }) => ({
  guarantees: many(bookingGuarantees),
}))

export const bookingGuaranteesRelations = relations(bookingGuarantees, ({ one }) => ({
  bookingPaymentSchedule: one(bookingPaymentSchedules, {
    fields: [bookingGuarantees.bookingPaymentScheduleId],
    references: [bookingPaymentSchedules.id],
  }),
  paymentInstrument: one(paymentInstruments, {
    fields: [bookingGuarantees.paymentInstrumentId],
    references: [paymentInstruments.id],
  }),
  paymentAuthorization: one(paymentAuthorizations, {
    fields: [bookingGuarantees.paymentAuthorizationId],
    references: [paymentAuthorizations.id],
    relationName: "guarantee_authorization",
  }),
}))

export const bookingItemTaxLinesRelations = relations(bookingItemTaxLines, () => ({}))

export const bookingItemCommissionsRelations = relations(bookingItemCommissions, () => ({}))

export const invoiceLineItemsRelations = relations(invoiceLineItems, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceLineItems.invoiceId], references: [invoices.id] }),
}))

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, { fields: [payments.invoiceId], references: [invoices.id] }),
  paymentInstrument: one(paymentInstruments, {
    fields: [payments.paymentInstrumentId],
    references: [paymentInstruments.id],
  }),
  paymentAuthorization: one(paymentAuthorizations, {
    fields: [payments.paymentAuthorizationId],
    references: [paymentAuthorizations.id],
  }),
  paymentCapture: one(paymentCaptures, {
    fields: [payments.paymentCaptureId],
    references: [paymentCaptures.id],
  }),
}))

export const creditNotesRelations = relations(creditNotes, ({ one, many }) => ({
  invoice: one(invoices, { fields: [creditNotes.invoiceId], references: [invoices.id] }),
  lineItems: many(creditNoteLineItems),
}))

export const creditNoteLineItemsRelations = relations(creditNoteLineItems, ({ one }) => ({
  creditNote: one(creditNotes, {
    fields: [creditNoteLineItems.creditNoteId],
    references: [creditNotes.id],
  }),
}))

export const supplierPaymentsRelations = relations(supplierPayments, ({ one }) => ({
  paymentInstrument: one(paymentInstruments, {
    fields: [supplierPayments.paymentInstrumentId],
    references: [paymentInstruments.id],
  }),
}))

export const financeNotesRelations = relations(financeNotes, ({ one }) => ({
  invoice: one(invoices, { fields: [financeNotes.invoiceId], references: [invoices.id] }),
}))

export const invoiceRenditionsRelations = relations(invoiceRenditions, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceRenditions.invoiceId], references: [invoices.id] }),
  template: one(invoiceTemplates, {
    fields: [invoiceRenditions.templateId],
    references: [invoiceTemplates.id],
  }),
}))

export const invoiceAttachmentsRelations = relations(invoiceAttachments, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceAttachments.invoiceId],
    references: [invoices.id],
  }),
}))

export const invoiceExternalRefsRelations = relations(invoiceExternalRefs, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceExternalRefs.invoiceId],
    references: [invoices.id],
  }),
}))

export const travelCreditsRelations = relations(travelCredits, ({ many }) => ({
  redemptions: many(travelCreditRedemptions),
}))

export const travelCreditRedemptionsRelations = relations(travelCreditRedemptions, ({ one }) => ({
  travelCredit: one(travelCredits, {
    fields: [travelCreditRedemptions.travelCreditId],
    references: [travelCredits.id],
  }),
}))

export const invoiceNumberSeriesRelations = relations(invoiceNumberSeries, () => ({}))
export const invoiceTemplatesRelations = relations(invoiceTemplates, ({ many }) => ({
  renditions: many(invoiceRenditions),
}))
export const taxRegimesRelations = relations(taxRegimes, () => ({}))
