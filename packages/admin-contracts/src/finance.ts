/**
 * Finance admin operations (first slice: invoice list/get, record payment,
 * create payment link).
 *
 * Output schemas are the curated client-facing projection of the finance
 * entities — not a 1:1 dump of `@voyantjs/finance`' Drizzle rows.
 */

import { z } from "zod"

import { defineOperation } from "./core/operation.js"
import { pageQuerySchema, paginated } from "./core/pagination.js"

export const invoiceSummarySchema = z.object({
  id: z.string(),
  invoiceNumber: z.string(),
  invoiceType: z.enum(["invoice", "proforma"]),
  status: z.string(),
  bookingId: z.string(),
  personId: z.string().nullable().optional(),
  organizationId: z.string().nullable().optional(),
  currency: z.string(),
  totalCents: z.number().int(),
  paidCents: z.number().int(),
  balanceDueCents: z.number().int(),
  issueDate: z.string(),
  dueDate: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type InvoiceSummary = z.infer<typeof invoiceSummarySchema>

export const paymentSchema = z.object({
  id: z.string(),
  invoiceId: z.string(),
  amountCents: z.number().int(),
  currency: z.string(),
  paymentMethod: z.string(),
  status: z.string(),
  paymentDate: z.string(),
  referenceNumber: z.string().nullable().optional(),
  createdAt: z.string(),
})

export type Payment = z.infer<typeof paymentSchema>

export const paymentLinkSchema = z.object({
  id: z.string(),
  status: z.string(),
  invoiceId: z.string().nullable().optional(),
  currency: z.string(),
  amountCents: z.number().int(),
  redirectUrl: z.string().nullable().optional(),
  provider: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  createdAt: z.string(),
})

export type PaymentLink = z.infer<typeof paymentLinkSchema>

// Fields mirror the route's `invoiceListQuerySchema` (no `invoiceType` filter
// exists server-side — `invoiceType` is an output field, not a list filter).
export const invoiceListInputSchema = pageQuerySchema.extend({
  status: z.string().optional(),
  bookingId: z.string().optional(),
  personId: z.string().optional(),
  organizationId: z.string().optional(),
  currency: z.string().optional(),
  search: z.string().optional(),
})

const PAYMENT_METHODS = [
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

export const recordPaymentInputSchema = z.object({
  amountCents: z.number().int().positive(),
  currency: z.string().length(3),
  paymentMethod: z.enum(PAYMENT_METHODS),
  paymentDate: z.string(),
  status: z.enum(["pending", "completed", "failed", "refunded"]).optional(),
  referenceNumber: z.string().max(255).optional(),
  notes: z.string().optional(),
})

// The route derives currency + amount from the invoice balance, so they are
// NOT accepted here. Fields mirror the route's payment-session provisioning
// schema (all optional).
export const createPaymentLinkInputSchema = z.object({
  provider: z.string().optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  payerEmail: z.string().email().optional(),
  payerName: z.string().optional(),
  returnUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  callbackUrl: z.string().url().optional(),
  externalReference: z.string().optional(),
  expiresAt: z.string().optional(),
})

const invoicesList = defineOperation({
  id: "finance.invoices.list",
  method: "GET",
  path: () => "/v1/admin/finance/invoices",
  pathTemplate: "/v1/admin/finance/invoices",
  input: invoiceListInputSchema,
  output: paginated(invoiceSummarySchema),
  classification: "read",
  scopes: ["finance:read"],
  envelope: "raw",
  summary: "List invoices and proformas with filters and offset pagination.",
})

const invoicesGet = defineOperation({
  id: "finance.invoices.get",
  method: "GET",
  path: (p: { id: string }) => `/v1/admin/finance/invoices/${p.id}`,
  pathTemplate: "/v1/admin/finance/invoices/:id",
  input: z.object({}),
  output: invoiceSummarySchema,
  classification: "read",
  scopes: ["finance:read"],
  summary: "Get a single invoice by id.",
})

const paymentsRecord = defineOperation({
  id: "finance.payments.record",
  method: "POST",
  path: (p: { id: string }) => `/v1/admin/finance/invoices/${p.id}/payments`,
  pathTemplate: "/v1/admin/finance/invoices/:id/payments",
  input: recordPaymentInputSchema,
  output: paymentSchema,
  classification: "routine_write",
  scopes: ["finance:write"],
  idempotent: true,
  summary: "Record a payment against an invoice.",
})

const paymentLinksCreate = defineOperation({
  id: "finance.paymentLinks.create",
  method: "POST",
  path: (p: { id: string }) => `/v1/admin/finance/invoices/${p.id}/payment-session`,
  pathTemplate: "/v1/admin/finance/invoices/:id/payment-session",
  input: createPaymentLinkInputSchema,
  output: paymentLinkSchema,
  classification: "routine_write",
  scopes: ["finance:write"],
  idempotent: true,
  summary:
    "Create a payment link (payment session) for an invoice. Amount and currency are taken from the invoice balance.",
})

export const financeOperations = {
  invoices: { list: invoicesList, get: invoicesGet },
  payments: { record: paymentsRecord },
  paymentLinks: { create: paymentLinksCreate },
} as const
