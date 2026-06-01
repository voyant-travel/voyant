import { z } from "zod"

import {
  paymentInstrumentStatusSchema,
  paymentInstrumentTypeSchema,
  paymentMethodSchema,
  paymentScheduleStatusSchema,
  paymentScheduleTypeSchema,
  paymentSessionStatusSchema,
  paymentSessionTargetTypeSchema,
} from "./validation-shared.js"

export const publicFinanceInvoiceTypeSchema = z.enum(["invoice", "proforma", "credit_note"])
export const publicFinanceDocumentAvailabilitySchema = z.enum([
  "missing",
  "pending",
  "ready",
  "failed",
  "stale",
])
export const publicFinanceDocumentFormatSchema = z.enum(["html", "pdf", "xml", "json"])

export const publicPaymentOptionsQuerySchema = z.object({
  personId: z.string().optional(),
  organizationId: z.string().optional(),
  provider: z.string().optional(),
  instrumentType: paymentInstrumentTypeSchema.optional(),
  includeInactive: z.coerce.boolean().default(false),
})

export const publicStartPaymentSessionSchema = z.object({
  provider: z.string().max(255).optional().nullable(),
  paymentMethod: paymentMethodSchema.optional().nullable(),
  paymentInstrumentId: z.string().optional().nullable(),
  payerPersonId: z.string().optional().nullable(),
  payerOrganizationId: z.string().optional().nullable(),
  payerEmail: z.string().email().optional().nullable(),
  payerName: z.string().max(255).optional().nullable(),
  externalReference: z.string().max(255).optional().nullable(),
  idempotencyKey: z.string().max(255).optional().nullable(),
  clientReference: z.string().max(255).optional().nullable(),
  returnUrl: z.string().url().optional().nullable(),
  cancelUrl: z.string().url().optional().nullable(),
  callbackUrl: z.string().url().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  providerPayload: z.record(z.string(), z.unknown()).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
})

export const publicValidateVoucherSchema = z.object({
  code: z.string().min(1).max(255),
  provider: z.string().max(255).optional().nullable(),
  bookingId: z.string().optional().nullable(),
  currency: z.string().min(3).max(3).optional().nullable(),
  amountCents: z.number().int().min(1).optional().nullable(),
})

export const publicFinanceDocumentLookupQuerySchema = z.object({
  reference: z.string().min(1).max(255),
  invoiceType: publicFinanceInvoiceTypeSchema.optional(),
})

export const publicPaymentAccountSchema = z.object({
  id: z.string(),
  label: z.string(),
  provider: z.string().nullable(),
  instrumentType: paymentInstrumentTypeSchema,
  status: paymentInstrumentStatusSchema,
  brand: z.string().nullable(),
  last4: z.string().nullable(),
  expiryMonth: z.number().int().nullable(),
  expiryYear: z.number().int().nullable(),
  isDefault: z.boolean(),
})

export const publicBookingPaymentScheduleSchema = z.object({
  id: z.string(),
  scheduleType: paymentScheduleTypeSchema,
  status: paymentScheduleStatusSchema,
  dueDate: z.string(),
  currency: z.string(),
  amountCents: z.number().int(),
  notes: z.string().nullable(),
})

export const publicBookingGuaranteeSchema = z.object({
  id: z.string(),
  bookingPaymentScheduleId: z.string().nullable(),
  guaranteeType: z.string(),
  status: z.string(),
  currency: z.string().nullable(),
  amountCents: z.number().int().nullable(),
  provider: z.string().nullable(),
  referenceNumber: z.string().nullable(),
  expiresAt: z.string().nullable(),
  notes: z.string().nullable(),
})

export const publicBookingPaymentOptionsSchema = z.object({
  bookingId: z.string(),
  accounts: z.array(publicPaymentAccountSchema),
  schedules: z.array(publicBookingPaymentScheduleSchema),
  guarantees: z.array(publicBookingGuaranteeSchema),
  recommendedTarget: z
    .object({
      targetType: z.enum(["booking_payment_schedule", "booking_guarantee"]).nullable(),
      targetId: z.string().nullable(),
    })
    .nullable(),
})

export const publicPaymentSessionSchema = z.object({
  id: z.string(),
  targetType: paymentSessionTargetTypeSchema,
  targetId: z.string().nullable(),
  bookingId: z.string().nullable(),
  invoiceId: z.string().nullable(),
  bookingPaymentScheduleId: z.string().nullable(),
  bookingGuaranteeId: z.string().nullable(),
  status: paymentSessionStatusSchema,
  provider: z.string().nullable(),
  providerSessionId: z.string().nullable(),
  providerPaymentId: z.string().nullable(),
  externalReference: z.string().nullable(),
  clientReference: z.string().nullable(),
  currency: z.string(),
  amountCents: z.number().int(),
  paymentMethod: paymentMethodSchema.nullable(),
  payerEmail: z.string().nullable(),
  payerName: z.string().nullable(),
  redirectUrl: z.string().nullable(),
  returnUrl: z.string().nullable(),
  cancelUrl: z.string().nullable(),
  expiresAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  failureCode: z.string().nullable(),
  failureMessage: z.string().nullable(),
  /**
   * Operator-supplied human-readable context (e.g. "London → New York,
   * Sat 16 May · Diego Müller"). Surfaced on the public landing page so
   * the customer can see what they're paying for. Server-controlled — only
   * populated when the session is created with `notes`.
   */
  notes: z.string().nullable(),
})

export const publicFinanceBookingDocumentSchema = z.object({
  invoiceId: z.string(),
  invoiceNumber: z.string(),
  invoiceType: publicFinanceInvoiceTypeSchema,
  invoiceStatus: z.enum([
    "draft",
    "pending_external_allocation",
    "issued",
    "partially_paid",
    "paid",
    "overdue",
    "void",
  ]),
  currency: z.string(),
  totalCents: z.number().int(),
  paidCents: z.number().int(),
  balanceDueCents: z.number().int(),
  issueDate: z.string(),
  dueDate: z.string(),
  renditionId: z.string().nullable(),
  documentStatus: publicFinanceDocumentAvailabilitySchema,
  format: publicFinanceDocumentFormatSchema.nullable(),
  language: z.string().nullable(),
  generatedAt: z.string().nullable(),
  fileSize: z.number().int().nullable(),
  checksum: z.string().nullable(),
  downloadUrl: z.string().nullable(),
})

export const publicBookingFinanceDocumentsSchema = z.object({
  bookingId: z.string(),
  documents: z.array(publicFinanceBookingDocumentSchema),
})

export const publicFinanceDocumentLookupSchema = publicFinanceBookingDocumentSchema.extend({
  bookingId: z.string(),
})

export const publicFinanceBookingPaymentSchema = z.object({
  id: z.string(),
  invoiceId: z.string(),
  invoiceNumber: z.string(),
  invoiceType: publicFinanceInvoiceTypeSchema,
  status: z.enum(["pending", "completed", "failed", "refunded"]),
  paymentMethod: paymentMethodSchema,
  amountCents: z.number().int(),
  currency: z.string(),
  /**
   * When the customer paid in a currency different from the invoice
   * (`currency`), `baseCurrency` is the invoice's currency and
   * `baseAmountCents` is the converted amount at the payment date.
   * Both are null for same-currency payments.
   */
  baseCurrency: z.string().nullable(),
  baseAmountCents: z.number().int().nullable(),
  paymentDate: z.string(),
  referenceNumber: z.string().nullable(),
  notes: z.string().nullable(),
})

export const publicBookingFinancePaymentsSchema = z.object({
  bookingId: z.string(),
  payments: z.array(publicFinanceBookingPaymentSchema),
})

export const publicVoucherValidationSchema = z.object({
  valid: z.boolean(),
  reason: z
    .enum([
      "not_found",
      "inactive",
      "not_started",
      "expired",
      "booking_mismatch",
      "currency_mismatch",
      "insufficient_balance",
    ])
    .nullable(),
  voucher: z
    .object({
      id: z.string(),
      code: z.string(),
      // Nullable: the new vouchers table (#239) doesn't carry a separate
      // label column — display falls back to `code`. Legacy
      // payment_instruments rows still populate this.
      label: z.string().nullable(),
      provider: z.string().nullable(),
      currency: z.string().nullable(),
      amountCents: z.number().int().nullable(),
      remainingAmountCents: z.number().int().nullable(),
      expiresAt: z.string().nullable(),
    })
    .nullable(),
})

export type PublicPaymentOptionsQuery = z.infer<typeof publicPaymentOptionsQuerySchema>
export type PublicBookingPaymentOptions = z.infer<typeof publicBookingPaymentOptionsSchema>
export type PublicPaymentSession = z.infer<typeof publicPaymentSessionSchema>
export type PublicFinanceBookingDocument = z.infer<typeof publicFinanceBookingDocumentSchema>
export type PublicBookingFinanceDocuments = z.infer<typeof publicBookingFinanceDocumentsSchema>
export type PublicFinanceDocumentLookupQuery = z.infer<
  typeof publicFinanceDocumentLookupQuerySchema
>
export type PublicFinanceDocumentLookup = z.infer<typeof publicFinanceDocumentLookupSchema>
export type PublicFinanceBookingPayment = z.infer<typeof publicFinanceBookingPaymentSchema>
export type PublicBookingFinancePayments = z.infer<typeof publicBookingFinancePaymentsSchema>
export type PublicStartPaymentSessionInput = z.infer<typeof publicStartPaymentSessionSchema>
export type PublicValidateVoucherInput = z.infer<typeof publicValidateVoucherSchema>
export type PublicVoucherValidationResult = z.infer<typeof publicVoucherValidationSchema>
