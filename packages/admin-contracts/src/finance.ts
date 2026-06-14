/**
 * Finance admin operations (first slice: invoice list/get, record payment,
 * create payment link).
 *
 * Output schemas are the curated client-facing projection of the finance
 * entities — not a 1:1 dump of `@voyant-travel/finance`' Drizzle rows.
 */

import {
  createPaymentSessionFromInvoiceSchema,
  insertPaymentSchema,
} from "@voyant-travel/finance-contracts"
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

// Derived from the route's canonical payment schema (`@voyant-travel/finance-contracts`)
// so the SDK input matches what `POST /invoices/:id/payments` accepts — single
// source of truth, no re-declared payment-method / status enums.
export const recordPaymentInputSchema = insertPaymentSchema.pick({
  amountCents: true,
  currency: true,
  paymentMethod: true,
  paymentDate: true,
  status: true,
  referenceNumber: true,
  notes: true,
})

// Derived from the route's payment-session provisioning schema. The route
// derives currency + amount from the invoice balance, so those are not picked.
export const createPaymentLinkInputSchema = createPaymentSessionFromInvoiceSchema.pick({
  provider: true,
  paymentMethod: true,
  payerEmail: true,
  payerName: true,
  returnUrl: true,
  cancelUrl: true,
  callbackUrl: true,
  externalReference: true,
  expiresAt: true,
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
