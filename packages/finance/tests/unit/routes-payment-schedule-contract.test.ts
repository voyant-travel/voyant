import { describe, expect, it } from "vitest"
import { z } from "zod"

import type { PaymentPolicy } from "../../src/payment-policy.js"
import type { PolledInvoiceSettlementResult } from "../../src/validation.js"

/**
 * Response contract tests (voyant#2114 — finance payment-schedule + settlement
 * backfill) for the converted admin/public route files:
 *
 *   - admin  POST /v1/admin/bookings/:bookingId/payment-schedule/regenerate
 *   - public POST /v1/public/payment-policy/resolve
 *   - admin  POST /v1/admin/finance/invoices/:id/poll-settlement
 *
 * Each fixture is typed as the real domain/service interface so shape drift
 * breaks compilation; the JSON round-trip mirrors `c.json` so a declared/actual
 * mismatch breaks the test. The schemas below mirror the response shapes
 * declared in `payment-schedule/routes.ts` and `routes-settlement.ts`.
 */

const depositRuleApiSchema = z.object({
  kind: z.enum(["none", "percent", "fixed_cents"]),
  percent: z.number().min(0).max(100).optional(),
  amountCents: z.number().int().min(0).optional(),
})

const policyApiSchema = z.object({
  deposit: depositRuleApiSchema,
  minDaysBeforeDepartureForDeposit: z.number().int().min(0),
  balanceDueDaysBeforeDeparture: z.number().int().min(0),
  balanceDueMinDaysFromNow: z.number().int().min(0),
})

const paymentPolicySourceSchema = z.enum([
  "booking",
  "listing",
  "category",
  "supplier",
  "operator_default",
])

const regenerateScheduleResponseSchema = z.object({
  data: z.object({
    schedule: z.array(z.unknown()),
    bookingPolicy: policyApiSchema.nullable(),
    cascadeSource: paymentPolicySourceSchema,
  }),
})

const resolvePolicyResponseSchema = z.object({
  data: z.object({
    policy: policyApiSchema,
    source: paymentPolicySourceSchema,
  }),
})

const polledInvoiceSettlementProviderResultSchema = z.object({
  provider: z.string(),
  externalRefId: z.string(),
  externalId: z.string().nullable(),
  externalNumber: z.string().nullable(),
  externalUrl: z.string().nullable(),
  status: z.string().nullable(),
  paidAmountCents: z.number().int().nullable(),
  unpaidAmountCents: z.number().int().nullable(),
  syncedAt: z.string().nullable(),
  settledAt: z.string().nullable(),
  createdPaymentId: z.string().nullable(),
  newlyAppliedAmountCents: z.number().int(),
  syncError: z.string().nullable(),
})

const polledInvoiceSettlementResultSchema = z.object({
  invoiceId: z.string(),
  invoiceStatus: z.enum([
    "draft",
    "pending_external_allocation",
    "issued",
    "partially_paid",
    "paid",
    "overdue",
    "void",
  ]),
  paidCents: z.number().int(),
  balanceDueCents: z.number().int(),
  results: z.array(polledInvoiceSettlementProviderResultSchema),
})

const errorResponseSchema = z.object({ error: z.string() })

const samplePolicy: PaymentPolicy = {
  deposit: { kind: "percent", percent: 20 },
  minDaysBeforeDepartureForDeposit: 30,
  balanceDueDaysBeforeDeparture: 45,
  balanceDueMinDaysFromNow: 7,
}

const settlementResult: PolledInvoiceSettlementResult = {
  invoiceId: "inv_0000000000000000000000000",
  invoiceStatus: "partially_paid",
  paidCents: 50000,
  balanceDueCents: 50000,
  results: [
    {
      provider: "smartbill",
      externalRefId: "iext_0000000000000000000000000",
      externalId: "SB-123",
      externalNumber: "FCT-2026-001",
      externalUrl: null,
      status: "issued",
      paidAmountCents: 50000,
      unpaidAmountCents: 50000,
      syncedAt: "2026-06-26T12:00:00.000Z",
      settledAt: null,
      createdPaymentId: "pay_0000000000000000000000000",
      newlyAppliedAmountCents: 50000,
      syncError: null,
    },
  ],
}

describe("finance payment-schedule + settlement response contracts", () => {
  it("the regenerate { data } envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(
      JSON.stringify({
        data: {
          schedule: [{ id: "bps_0000000000000000000000000", amountCents: 50000 }],
          bookingPolicy: samplePolicy,
          cascadeSource: "operator_default",
        },
      }),
    )
    const parsed = regenerateScheduleResponseSchema.safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the regenerate envelope allows a null booking policy", () => {
    const parsed = regenerateScheduleResponseSchema.safeParse({
      data: { schedule: [], bookingPolicy: null, cascadeSource: "supplier" },
    })
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the resolve { data } envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: { policy: samplePolicy, source: "listing" } }))
    const parsed = resolvePolicyResponseSchema.safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the poll-settlement { data } envelope satisfies the declared OpenAPI schema", () => {
    const wire = JSON.parse(JSON.stringify({ data: settlementResult }))
    const parsed = z.object({ data: polledInvoiceSettlementResultSchema }).safeParse(wire)
    expect(parsed.success ? null : parsed.error.toString()).toBeNull()
  })

  it("the poll-settlement 404 envelope satisfies the declared OpenAPI schema", () => {
    const parsed = errorResponseSchema.safeParse({ error: "Invoice not found" })
    expect(parsed.success).toBe(true)
  })
})
