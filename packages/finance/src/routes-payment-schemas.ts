/**
 * Shared OpenAPI response row schemas for the finance payments admin routes
 * (voyant#2114 / voyant#2208 — finance sub-batch 9C). Authored from the Drizzle
 * `$inferSelect` shapes of the payments-family tables (`supplier_payments`,
 * `payment_instruments`, `payment_authorizations`, `payment_captures`,
 * `travel_credits`, `travel_credit_redemptions`) plus the enriched `UnifiedPaymentRow`
 * projection that `listAllPayments` / `getPaymentById` return.
 *
 * §17: timestamp / `date` columns serialize to strings over the wire; integer
 * money columns (`*_cents`) and integer scalar columns stay numbers. Untyped
 * jsonb (`metadata` on instruments) is `z.unknown().nullable()`. The
 * `paymentSessionSchema` row shape already lives in `routes-invoice-schemas.ts`
 * and is reused by the payment-processing routes.
 */

import { z } from "@hono/zod-openapi"

/** `date`/timestamp columns serialize to strings (§17). */
const isoString = z.string()
/** Untyped jsonb columns. */
const unknownJsonb = z.unknown().nullable()

const paymentMethodValues = [
  "bank_transfer",
  "credit_card",
  "debit_card",
  "cash",
  "cheque",
  "wallet",
  "direct_bill",
  "travel_credit",
  "other",
] as const

const paymentStatusValues = ["pending", "completed", "failed", "refunded"] as const

const paymentInstrumentTypeValues = [
  "credit_card",
  "debit_card",
  "bank_account",
  "wallet",
  "travel_credit",
  "direct_bill",
  "cash",
  "other",
] as const

const paymentInstrumentOwnerTypeValues = [
  "client",
  "supplier",
  "channel",
  "agency",
  "internal",
  "other",
] as const

const paymentInstrumentStatusValues = [
  "active",
  "inactive",
  "expired",
  "revoked",
  "failed_verification",
] as const

const paymentAuthorizationStatusValues = [
  "pending",
  "authorized",
  "partially_captured",
  "captured",
  "voided",
  "failed",
  "expired",
] as const

const captureModeValues = ["automatic", "manual"] as const

const paymentCaptureStatusValues = ["pending", "completed", "failed", "refunded", "voided"] as const

const travelCreditStatusValues = ["active", "redeemed", "expired", "void"] as const

const travelCreditSourceTypeValues = [
  "refund",
  "cancellation_credit",
  "gift",
  "manual",
  "goodwill",
  "promotion",
] as const

// --- unified payment (customer + supplier projection) ---------------------

/** `UnifiedPaymentRow` — the enriched UNION projection of `payments` + `supplier_payments`. */
export const unifiedPaymentSchema = z.object({
  kind: z.enum(["customer", "supplier"]),
  id: z.string(),
  invoiceId: z.string().nullable(),
  invoiceNumber: z.string().nullable(),
  bookingId: z.string().nullable(),
  bookingNumber: z.string().nullable(),
  supplierId: z.string().nullable(),
  supplierName: z.string().nullable(),
  personId: z.string().nullable(),
  personName: z.string().nullable(),
  organizationId: z.string().nullable(),
  organizationName: z.string().nullable(),
  amountCents: z.number().int(),
  currency: z.string(),
  baseCurrency: z.string().nullable(),
  baseAmountCents: z.number().int().nullable(),
  paymentMethod: z.string(),
  status: z.string(),
  referenceNumber: z.string().nullable(),
  paymentDate: isoString,
  notes: z.string().nullable(),
  createdAt: isoString,
  updatedAt: isoString,
})

// --- supplier payments ----------------------------------------------------

/** Bare `supplier_payments.$inferSelect` wire shape. */
export const supplierPaymentSchema = z.object({
  id: z.string(),
  bookingId: z.string().nullable(),
  supplierId: z.string().nullable(),
  bookingSupplierStatusId: z.string().nullable(),
  supplierInvoiceId: z.string().nullable(),
  amountCents: z.number().int(),
  currency: z.string(),
  baseCurrency: z.string().nullable(),
  baseAmountCents: z.number().int().nullable(),
  fxRateSetId: z.string().nullable(),
  paymentMethod: z.enum(paymentMethodValues),
  paymentInstrumentId: z.string().nullable(),
  status: z.enum(paymentStatusValues),
  referenceNumber: z.string().nullable(),
  paymentDate: isoString,
  notes: z.string().nullable(),
  createdAt: isoString,
  updatedAt: isoString,
})

// --- payment instruments --------------------------------------------------

export const paymentInstrumentSchema = z.object({
  id: z.string(),
  ownerType: z.enum(paymentInstrumentOwnerTypeValues),
  personId: z.string().nullable(),
  organizationId: z.string().nullable(),
  supplierId: z.string().nullable(),
  channelId: z.string().nullable(),
  instrumentType: z.enum(paymentInstrumentTypeValues),
  status: z.enum(paymentInstrumentStatusValues),
  label: z.string(),
  provider: z.string().nullable(),
  brand: z.string().nullable(),
  last4: z.string().nullable(),
  holderName: z.string().nullable(),
  expiryMonth: z.number().int().nullable(),
  expiryYear: z.number().int().nullable(),
  externalToken: z.string().nullable(),
  externalCustomerId: z.string().nullable(),
  billingEmail: z.string().nullable(),
  billingAddress: z.string().nullable(),
  directBillReference: z.string().nullable(),
  notes: z.string().nullable(),
  metadata: unknownJsonb,
  createdAt: isoString,
  updatedAt: isoString,
})

// --- payment authorizations -----------------------------------------------

export const paymentAuthorizationSchema = z.object({
  id: z.string(),
  bookingId: z.string().nullable(),
  orderId: z.string().nullable(),
  invoiceId: z.string().nullable(),
  bookingGuaranteeId: z.string().nullable(),
  paymentInstrumentId: z.string().nullable(),
  status: z.enum(paymentAuthorizationStatusValues),
  captureMode: z.enum(captureModeValues),
  currency: z.string(),
  amountCents: z.number().int(),
  provider: z.string().nullable(),
  externalAuthorizationId: z.string().nullable(),
  approvalCode: z.string().nullable(),
  authorizedAt: isoString.nullable(),
  expiresAt: isoString.nullable(),
  voidedAt: isoString.nullable(),
  notes: z.string().nullable(),
  createdAt: isoString,
  updatedAt: isoString,
})

// --- payment captures -----------------------------------------------------

export const paymentCaptureSchema = z.object({
  id: z.string(),
  paymentAuthorizationId: z.string().nullable(),
  invoiceId: z.string().nullable(),
  status: z.enum(paymentCaptureStatusValues),
  currency: z.string(),
  amountCents: z.number().int(),
  provider: z.string().nullable(),
  externalCaptureId: z.string().nullable(),
  capturedAt: isoString.nullable(),
  settledAt: isoString.nullable(),
  notes: z.string().nullable(),
  createdAt: isoString,
  updatedAt: isoString,
})

// --- travel credits --------------------------------------------------------

export const travelCreditSchema = z.object({
  id: z.string(),
  code: z.string(),
  seriesCode: z.string().nullable(),
  status: z.enum(travelCreditStatusValues),
  currency: z.string(),
  initialAmountCents: z.number().int(),
  remainingAmountCents: z.number().int(),
  issuedToPersonId: z.string().nullable(),
  issuedToOrganizationId: z.string().nullable(),
  sourceType: z.enum(travelCreditSourceTypeValues),
  sourceBookingId: z.string().nullable(),
  sourcePaymentId: z.string().nullable(),
  validFrom: isoString.nullable(),
  expiresAt: isoString.nullable(),
  notes: z.string().nullable(),
  issuedByUserId: z.string().nullable(),
  createdAt: isoString,
  updatedAt: isoString,
})

export const travelCreditRedemptionSchema = z.object({
  id: z.string(),
  travelCreditId: z.string(),
  bookingId: z.string(),
  paymentId: z.string().nullable(),
  idempotencyKey: z.string().nullable(),
  amountCents: z.number().int(),
  createdAt: isoString,
  createdByUserId: z.string().nullable(),
})

export const travelCreditDetailSchema = travelCreditSchema.extend({
  redemptions: z.array(travelCreditRedemptionSchema),
})

/** `travelCredits.redeem` returns the updated travel credit and redemption row. */
export const travelCreditRedeemResultSchema = z.object({
  travelCredit: travelCreditSchema,
  redemption: travelCreditRedemptionSchema.nullable(),
})
